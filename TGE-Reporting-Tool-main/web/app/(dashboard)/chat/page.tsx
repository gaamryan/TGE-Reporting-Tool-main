"use client";

import { useState } from "react";
import { ChatInterface } from "@/components/chat/chat-interface";
import { WidgetWithData } from "@/components/widgets/widget-with-data";
import { WidgetConfig } from "@/types/widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateId } from "@/lib/utils";
import { LayoutDashboard, Trash2, Save } from "lucide-react";

export default function ChatPage() {
  const [generatedWidgets, setGeneratedWidgets] = useState<WidgetConfig[]>([]);

  const handleAddWidget = (widget: WidgetConfig) => {
    const newWidget = { ...widget, id: generateId() };
    setGeneratedWidgets((prev) => [...prev, newWidget]);
  };

  const handleRemoveWidget = (id: string) => {
    setGeneratedWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  const handleSaveToDashboard = () => {
    // TODO: Implement save to dashboard
    alert("Widgets would be saved to dashboard!");
  };

  return (
    <div className="flex h-full">
      {/* Chat area - full width on mobile, 1/2 on desktop */}
      <div className="flex-1 lg:w-1/2 lg:border-r">
        <ChatInterface onAddWidget={handleAddWidget} className="h-full rounded-none border-0" />
      </div>

      {/* Generated widgets area - hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-semibold">Generated Widgets</h2>
            <p className="text-sm text-muted-foreground">
              {generatedWidgets.length} widget{generatedWidgets.length !== 1 ? "s" : ""} created
            </p>
          </div>
          {generatedWidgets.length > 0 && (
            <Button onClick={handleSaveToDashboard}>
              <Save className="h-4 w-4 mr-2" />
              Save to Dashboard
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 p-4">
          {generatedWidgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <LayoutDashboard className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No widgets yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Ask the AI assistant to create charts and visualizations.
                They'll appear here for review.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {generatedWidgets.map((widget) => (
                <Card key={widget.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{widget.title}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRemoveWidget(widget.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <WidgetWithData
                      config={widget}
                      showSampleOnEmpty={true}
                      className="border-0 shadow-none p-0"
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
