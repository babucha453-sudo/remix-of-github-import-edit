import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SeoPagePicker, SeoPage } from '@/components/admin/seo/SeoPagePicker';
import { BulkActionsPanel } from '@/components/admin/seo/BulkActionsPanel';
import { JobsHistoryPanel } from '@/components/admin/seo/JobsHistoryPanel';
import { Bot, Zap, History, Search } from 'lucide-react';

export default function SeoOperationsCenterTab() {
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('operations');

  const handleInspectPage = (page: SeoPage) => {
    window.open(`https://www.appointpanda.com${page.slug}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-teal flex items-center justify-center shadow-lg">
          <Bot className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold">SEO Operations Center</h1>
          <p className="text-muted-foreground">
            Select pages, configure regeneration, apply fixes with preview & rollback
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="operations" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Operations
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History & Rollback
          </TabsTrigger>
          <TabsTrigger value="diagnostics" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Indexing Diagnostics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="operations" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <SeoPagePicker
                selectedPages={selectedPages}
                onSelectionChange={setSelectedPages}
                onInspectPage={handleInspectPage}
              />
            </div>
            <div>
              <BulkActionsPanel
                selectedPageIds={selectedPages}
                onJobStarted={() => setActiveTab('history')}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <JobsHistoryPanel />
        </TabsContent>

        <TabsContent value="diagnostics" className="mt-6">
          <div className="p-8 text-center text-muted-foreground border rounded-lg">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="font-medium mb-2">Indexing Diagnostics</h3>
            <p className="text-sm">
              Select pages in the Operations tab to run indexing diagnostics - 
              checks for canonical issues, sitemap presence, internal links, and rendered HTML content.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
