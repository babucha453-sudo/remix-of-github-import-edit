import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, FolderOpen } from 'lucide-react';
import { useUserTabPermissions, useSaveTabPermissions, getTabsByCategory, AVAILABLE_TABS } from '@/hooks/useTabPermissions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface TabPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userRole: string;
}

export default function TabPermissionsDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userRole,
}: TabPermissionsDialogProps) {
  const { data: currentPermissions, isLoading } = useUserTabPermissions(userId);
  const savePermissions = useSaveTabPermissions();
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  
  const tabsByCategory = getTabsByCategory();
  
  // Initialize with current permissions
  useEffect(() => {
    if (currentPermissions) {
      setSelectedTabs(currentPermissions.filter(p => p.can_access).map(p => p.tab_key));
    }
  }, [currentPermissions]);
  
  const toggleTab = (tabKey: string) => {
    setSelectedTabs(prev => 
      prev.includes(tabKey) 
        ? prev.filter(t => t !== tabKey)
        : [...prev, tabKey]
    );
  };
  
  const toggleCategory = (category: string, checked: boolean) => {
    const categoryTabs = tabsByCategory[category]?.map(t => t.key) || [];
    if (checked) {
      setSelectedTabs(prev => [...new Set([...prev, ...categoryTabs])]);
    } else {
      setSelectedTabs(prev => prev.filter(t => !categoryTabs.includes(t)));
    }
  };
  
  const isCategoryChecked = (category: string) => {
    const categoryTabs = tabsByCategory[category]?.map(t => t.key) || [];
    return categoryTabs.every(t => selectedTabs.includes(t));
  };
  
  const isCategoryIndeterminate = (category: string) => {
    const categoryTabs = tabsByCategory[category]?.map(t => t.key) || [];
    const selectedCount = categoryTabs.filter(t => selectedTabs.includes(t)).length;
    return selectedCount > 0 && selectedCount < categoryTabs.length;
  };
  
  const selectAll = () => setSelectedTabs(AVAILABLE_TABS.map(t => t.key));
  const clearAll = () => setSelectedTabs([]);
  
  const handleSave = () => {
    savePermissions.mutate(
      { userId, tabs: selectedTabs },
      { onSuccess: () => onOpenChange(false) }
    );
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Tab Permissions for {userName}
          </DialogTitle>
          <DialogDescription>
            Select which admin tabs this user can access. Current role: <Badge variant="outline">{userRole}</Badge>
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">
                {selectedTabs.length} of {AVAILABLE_TABS.length} tabs selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
                <Button variant="ghost" size="sm" onClick={clearAll}>Clear All</Button>
              </div>
            </div>
            
            <ScrollArea className="flex-1 pr-4">
              <Accordion type="multiple" defaultValue={Object.keys(tabsByCategory)} className="w-full">
                {Object.entries(tabsByCategory).map(([category, tabs]) => (
                  <AccordionItem key={category} value={category}>
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isCategoryChecked(category)}
                          onCheckedChange={(checked) => toggleCategory(category, !!checked)}
                          onClick={(e) => e.stopPropagation()}
                          className={isCategoryIndeterminate(category) ? 'data-[state=checked]:bg-primary/50' : ''}
                        />
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{category}</span>
                        <Badge variant="secondary" className="ml-2">
                          {tabs.filter(t => selectedTabs.includes(t.key)).length}/{tabs.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 gap-2 pl-10 pb-2">
                        {tabs.map((tab) => (
                          <div
                            key={tab.key}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                              selectedTabs.includes(tab.key)
                                ? 'border-primary/50 bg-primary/5'
                                : 'border-border hover:border-primary/30'
                            }`}
                            onClick={() => toggleTab(tab.key)}
                          >
                            <Checkbox
                              checked={selectedTabs.includes(tab.key)}
                              onCheckedChange={() => toggleTab(tab.key)}
                            />
                            <Label className="cursor-pointer text-sm">{tab.label}</Label>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
            
            <DialogFooter className="pt-4 border-t border-border">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={savePermissions.isPending}
                className="gap-2"
              >
                {savePermissions.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Permissions
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
