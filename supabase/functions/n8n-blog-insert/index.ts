import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BlogContent {
  type: 'markdown' | 'html' | 'json';
  body: string;
}

interface BlogPostRequest {
  api_key: string;
  id?: string;
  title: string;
  slug: string;
  content?: string | BlogContent;
  excerpt?: string;
  category?: string;
  tags?: string[];
  author_name?: string;
  seo_title?: string;
  seo_description?: string;
  status?: string;
  is_featured?: boolean;
  featured_image_url?: string;
  featured_image_base64?: string;
  featured_image_filename?: string;
  featured_image_source_url?: string; // New: URL to fetch image from
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: BlogPostRequest = await req.json();
    console.log('Received blog post request:', { title: body.title, slug: body.slug, hasBase64Image: !!body.featured_image_base64 });

    // Validate API key
    const expectedApiKey = Deno.env.get('N8N_API_KEY');
    if (!expectedApiKey) {
      console.error('N8N_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.api_key || body.api_key !== expectedApiKey) {
      console.error('Invalid API key provided');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!body.title || !body.slug) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: title and slug are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle featured image upload - ALWAYS download and store in our database
    let finalImageUrl: string | null = null;

    // Helper function to download image from URL and upload to our storage
    const downloadAndStoreImage = async (imageUrl: string): Promise<string | null> => {
      try {
        console.log('Downloading image from URL:', imageUrl);
        
        const imageResponse = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; DentalDirectory/1.0)',
          },
        });
        
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
        }
        
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await imageResponse.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        if (bytes.length < 100) {
          throw new Error('Downloaded image is too small, likely invalid');
        }
        
        // Generate filename from slug and timestamp
        const extension = contentType.split('/')[1]?.replace('jpeg', 'jpg').split(';')[0] || 'jpg';
        const sanitizedSlug = body.slug.replace(/[^a-z0-9-]/g, '-').substring(0, 50);
        const filename = body.featured_image_filename || 
          `${sanitizedSlug}-${Date.now()}.${extension}`;
        
        console.log(`Uploading image to storage: ${filename}, size: ${bytes.length} bytes, type: ${contentType}`);
        
        // Upload to our storage bucket
        const { error: uploadError } = await supabase.storage
          .from('blog-images')
          .upload(filename, bytes, {
            contentType: contentType.split(';')[0], // Remove charset if present
            upsert: true
          });
        
        if (uploadError) {
          console.error('Image upload error:', uploadError);
          throw uploadError;
        }
        
        // Get our public URL
        const { data: { publicUrl } } = supabase.storage
          .from('blog-images')
          .getPublicUrl(filename);
        
        console.log('Image stored successfully in our database:', publicUrl);
        return publicUrl;
      } catch (error) {
        console.error('Image download/upload error:', error);
        return null;
      }
    };

    // Priority 1: Use featured_image_source_url (explicit source URL field)
    if (body.featured_image_source_url) {
      console.log('Processing featured_image_source_url...');
      finalImageUrl = await downloadAndStoreImage(body.featured_image_source_url);
    }
    
    // Priority 2: Use featured_image_url if it's a third-party URL (download and store locally)
    if (!finalImageUrl && body.featured_image_url) {
      const imageUrl = body.featured_image_url;
      
      // Check if this is already our own storage URL
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const isOurStorageUrl = imageUrl.includes(supabaseUrl) || 
                              imageUrl.includes('supabase.co/storage');
      
      if (isOurStorageUrl) {
        // Already our URL, use as-is
        console.log('Image already in our storage, using existing URL');
        finalImageUrl = imageUrl;
      } else {
        // Third-party URL - download and store in our database
        console.log('Third-party image URL detected, downloading and storing locally...');
        finalImageUrl = await downloadAndStoreImage(imageUrl);
        
        // If download failed, don't use the third-party URL
        if (!finalImageUrl) {
          console.warn('Failed to download third-party image, featured_image_url will be null');
        }
      }
    }

    // Priority 2: Process base64 if provided and no image yet
    if (body.featured_image_base64 && !finalImageUrl) {
      try {
        console.log('Processing base64 image upload...');
        
        let base64Data = body.featured_image_base64;
        let mimeType = 'image/png';
        
        // Check if it's a data URL format
        if (base64Data.includes('base64,')) {
          const parts = base64Data.split('base64,');
          const mimeMatch = parts[0].match(/data:([^;]+)/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
          }
          base64Data = parts[1];
        }
        
        // Skip if base64 is a filesystem reference (n8n filesystem-v2)
        if (base64Data.startsWith('filesystem') || base64Data.length < 100) {
          console.log('Skipping invalid base64 data (filesystem reference or too short)');
        } else {
          base64Data = base64Data.replace(/\s/g, '');
          
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
          const sanitizedSlug = body.slug.replace(/[^a-z0-9-]/g, '-').substring(0, 50);
          const filename = body.featured_image_filename || 
            `${sanitizedSlug}-${Date.now()}.${extension}`;
          
          console.log(`Uploading base64 image: ${filename}, size: ${bytes.length} bytes`);
          
          const { error: uploadError } = await supabase.storage
            .from('blog-images')
            .upload(filename, bytes, {
              contentType: mimeType,
              upsert: true
            });
          
          if (uploadError) {
            console.error('Image upload error:', uploadError);
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('blog-images')
              .getPublicUrl(filename);
            
            finalImageUrl = publicUrl;
            console.log('Image uploaded successfully:', finalImageUrl);
          }
        }
      } catch (imageError) {
        console.error('Image processing error:', imageError);
      }
    }

    // Prepare content as JSONB format
    let contentJsonb = null;
    if (body.content) {
      if (typeof body.content === 'string') {
        // Convert string content to JSONB format
        contentJsonb = { type: 'markdown', body: body.content };
      } else if (typeof body.content === 'object' && body.content.body) {
        // Already in JSONB format
        contentJsonb = body.content;
      }
    }

    // Prepare blog post data
    const blogPost = {
      title: body.title,
      slug: body.slug,
      content: contentJsonb,
      excerpt: body.excerpt || null,
      category: body.category || null,
      tags: body.tags || null,
      author_name: body.author_name || 'DentalDirectory Team',
      seo_title: body.seo_title || body.title,
      seo_description: body.seo_description || body.excerpt || null,
      status: body.status || 'draft',
      is_featured: body.is_featured || false,
      featured_image_url: finalImageUrl,
      published_at: body.status === 'published' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    console.log('Upserting blog post:', { 
      slug: blogPost.slug, 
      title: blogPost.title, 
      status: blogPost.status,
      hasImage: !!blogPost.featured_image_url
    });

    // Upsert into blog_posts table (insert or update based on slug)
    const { data, error } = await supabase
      .from('blog_posts')
      .upsert(blogPost, { 
        onConflict: 'slug',
        ignoreDuplicates: false 
      })
      .select('id, title, slug, status, featured_image_url')
      .single();

    if (error) {
      console.error('Database upsert error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Blog post upserted successfully:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        id: data.id,
        title: data.title,
        slug: data.slug,
        status: data.status,
        featured_image_url: data.featured_image_url,
        message: 'Blog post created or updated successfully'
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
