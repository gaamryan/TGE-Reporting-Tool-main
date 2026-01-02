"use client";

import { useState, useRef, useEffect } from "react";
import { useCopilotChat, useCopilotAction } from "@copilotkit/react-core";
import { Role, TextMessage, Message } from "@copilotkit/runtime-client-gql";
import "@copilotkit/react-ui/styles.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { WidgetWithData } from "@/components/widgets/widget-with-data";
import { WidgetConfig } from "@/types/widget";
import { cn, generateId } from "@/lib/utils";
import { Send, Plus, Bot, User, Sparkles, LayoutDashboard } from "lucide-react";

interface ChatInterfaceProps {
  onAddWidget?: (widget: WidgetConfig) => void;
  className?: string;
}

export function ChatInterface({ onAddWidget, className }: ChatInterfaceProps) {
  const [pendingWidget, setPendingWidget] = useState<WidgetConfig | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Use CopilotKit chat hook - this connects to the real AI
  const {
    visibleMessages,
    appendMessage,
    isLoading,
  } = useCopilotChat();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleMessages]);

  // Register CopilotKit action for widget generation
  useCopilotAction({
    name: "generateWidget",
    description: "Generate a dashboard widget based on user request. Use this when the user asks to visualize data, create a chart, or add a widget.",
    parameters: [
      {
        name: "type",
        type: "string",
        description: "Widget type: bar, line, area, donut, table, or metric",
        required: true,
      },
      {
        name: "title",
        type: "string",
        description: "Display title for the widget",
        required: true,
      },
      {
        name: "description",
        type: "string",
        description: "Brief description of what the widget shows",
        required: false,
      },
      {
        name: "source",
        type: "string",
        description: "Data source: v_lead_attribution, v_source_summary, v_team_summary, v_agent_summary, source_leads, fub_leads, or lead_matches",
        required: true,
      },
      {
        name: "groupBy",
        type: "string",
        description: "Field to group data by (e.g., source_system, status, created_at)",
        required: false,
      },
      {
        name: "dateRange",
        type: "string",
        description: "Date range preset: today, yesterday, 7d, 30d, 90d, ytd, or all",
        required: false,
      },
      {
        name: "size",
        type: "string",
        description: "Widget size: sm, md, lg, xl, or full. Defaults to md",
        required: false,
      },
    ],
    handler: async ({ type, title, description, source, groupBy, dateRange, size }) => {
      const widget: WidgetConfig = {
        id: generateId(),
        type: type as WidgetConfig["type"],
        title: title as string,
        description: description as string | undefined,
        size: (size as WidgetConfig["size"]) || "md",
        query: {
          source: source as WidgetConfig["query"]["source"],
          groupBy: groupBy ? [groupBy as string] : undefined,
          dateRange: dateRange
            ? { field: "created_at", preset: dateRange as "7d" | "30d" | "90d" | "today" | "yesterday" | "ytd" | "all" }
            : undefined,
        },
        visualization: {
          xAxis: (groupBy as string) || "name",
          yAxis: "value",
          showLegend: true,
        },
      };
      setPendingWidget(widget);
      return `I've created a ${widget.type} widget: "${widget.title}". Would you like to add it to your dashboard?`;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Send message through CopilotKit
    appendMessage(new TextMessage({ content: input, role: Role.User }));
    setInput("");
  };

  const handleAddWidget = () => {
    if (pendingWidget && onAddWidget) {
      onAddWidget(pendingWidget);
      setPendingWidget(null);
    }
  };

  // Helper to get message content
  const getMessageContent = (message: typeof visibleMessages[0]): string => {
    if (message.isTextMessage()) {
      return message.content;
    }
    if (message.isActionExecutionMessage()) {
      return `Executing action: ${message.name}`;
    }
    if (message.isResultMessage()) {
      return message.result || "";
    }
    return "";
  };

  // Filter to only show text messages (user and assistant)
  const displayMessages = visibleMessages.filter(
    (m) => m.isTextMessage() && getMessageContent(m).trim()
  );

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="flex-none border-b">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">AI Assistant</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ask questions about your data or create widgets
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {/* Welcome message if no messages */}
            {displayMessages.length === 0 && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 flex-none">
                  <AvatarFallback className="bg-muted">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2 max-w-[80%]">
                  <div className="rounded-lg px-4 py-2 bg-muted">
                    <p className="text-sm whitespace-pre-wrap">
                      Hi! I can help you explore your lead data and create dashboard widgets. Try asking me something like:
                      {"\n\n"}- "Show me Zillow leads by week"
                      {"\n"}- "What's our match rate by source?"
                      {"\n"}- "Create a chart of leads by status"
                      {"\n"}- "How many leads came in yesterday?"
                    </p>
                  </div>
                </div>
              </div>
            )}

            {displayMessages.map((message) => {
              // TextMessage has role property
              const textMsg = message as TextMessage;
              const role = textMsg.role === Role.User ? "user" : "assistant";
              const content = getMessageContent(message);

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3 animate-message-in",
                    role === "user" ? "flex-row-reverse" : ""
                  )}
                >
                  <Avatar className="h-8 w-8 flex-none">
                    <AvatarFallback
                      className={cn(
                        role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {role === "user" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>

                  <div
                    className={cn(
                      "flex flex-col gap-2 max-w-[80%]",
                      role === "user" ? "items-end" : ""
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-lg px-4 py-2",
                        role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{content}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-muted">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Pending widget action */}
        {pendingWidget && onAddWidget && (
          <div className="flex-none border-t p-4 bg-muted/50">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <LayoutDashboard className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate">
                  Add <strong>{pendingWidget.title}</strong> to dashboard?
                </span>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setPendingWidget(null)}>
                  Dismiss
                </Button>
                <Button size="sm" onClick={handleAddWidget}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Widget
                </Button>
              </div>
            </div>
            {/* Widget preview - fetches real data from Supabase */}
            <div className="mt-3">
              <WidgetWithData
                config={pendingWidget}
                showSampleOnEmpty={true}
              />
            </div>
          </div>
        )}

        {/* Input */}
        <div className="flex-none border-t p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your leads or create a widget..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
