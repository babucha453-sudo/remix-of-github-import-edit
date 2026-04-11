// Helper functions for handling blog post JSONB content

export interface BlogContent {
  type: 'markdown' | 'html' | 'json';
  body: string;
}

/**
 * Extract the text body from JSONB content
 * Handles both new JSONB format and legacy string format
 */
export function getContentBody(content: unknown): string {
  if (!content) return '';
  
  // Handle legacy string content (shouldn't happen after migration, but just in case)
  if (typeof content === 'string') {
    return content;
  }
  
  // Handle JSONB object format
  if (typeof content === 'object' && content !== null) {
    const jsonContent = content as Record<string, unknown>;
    if (typeof jsonContent.body === 'string') {
      return jsonContent.body;
    }
    // If it's just a plain object, try to stringify it
    return JSON.stringify(content);
  }
  
  return '';
}

/**
 * Create a JSONB content object from a string
 */
export function createContentObject(body: string, type: 'markdown' | 'html' | 'json' = 'markdown'): BlogContent {
  return {
    type,
    body,
  };
}

/**
 * Calculate reading time from content
 */
export function calculateReadingTime(content: unknown): number {
  const body = getContentBody(content);
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}
