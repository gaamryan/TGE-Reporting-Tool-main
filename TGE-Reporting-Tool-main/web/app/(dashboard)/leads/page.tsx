"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Download, RefreshCw } from "lucide-react";

// Sample data
const leads = [
  {
    id: "1",
    email: "john.smith@email.com",
    name: "John Smith",
    phone: "(555) 123-4567",
    source: "Zillow",
    address: "123 Main St, Austin, TX",
    status: "matched",
    matchConfidence: 0.98,
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    email: "jane.doe@email.com",
    name: "Jane Doe",
    phone: "(555) 234-5678",
    source: "Realtor.com",
    address: "456 Oak Ave, Austin, TX",
    status: "pending",
    matchConfidence: null,
    createdAt: "2024-01-15",
  },
  {
    id: "3",
    email: "bob.wilson@email.com",
    name: "Bob Wilson",
    phone: "(555) 345-6789",
    source: "OpCity",
    address: "789 Pine Rd, Austin, TX",
    status: "review",
    matchConfidence: 0.72,
    createdAt: "2024-01-14",
  },
  {
    id: "4",
    email: "alice.johnson@email.com",
    name: "Alice Johnson",
    phone: "(555) 456-7890",
    source: "Zillow",
    address: "321 Elm St, Austin, TX",
    status: "unmatched",
    matchConfidence: 0.35,
    createdAt: "2024-01-14",
  },
  {
    id: "5",
    email: "charlie.brown@email.com",
    name: "Charlie Brown",
    phone: "(555) 567-8901",
    source: "Ylopo",
    address: "654 Maple Dr, Austin, TX",
    status: "matched",
    matchConfidence: 1.0,
    createdAt: "2024-01-13",
  },
];

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  matched: "default",
  pending: "secondary",
  review: "outline",
  unmatched: "destructive",
};

const statusColors: Record<string, string> = {
  matched: "bg-green-100 text-green-800",
  pending: "bg-gray-100 text-gray-800",
  review: "bg-yellow-100 text-yellow-800",
  unmatched: "bg-red-100 text-red-800",
};

export default function LeadsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.address.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    const matchesSource = sourceFilter === "all" || lead.source === sourceFilter;

    return matchesSearch && matchesStatus && matchesSource;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            View and manage imported leads from all sources
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="unmatched">Unmatched</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="Zillow">Zillow</SelectItem>
                <SelectItem value="Realtor.com">Realtor.com</SelectItem>
                <SelectItem value="OpCity">OpCity</SelectItem>
                <SelectItem value="Ylopo">Ylopo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lead List</CardTitle>
          <CardDescription>{filteredLeads.length} leads found</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
                <TableRow key={lead.id} className="hover:bg-muted/50 cursor-pointer">
                  <TableCell>
                    <span className="font-medium">{lead.name}</span>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{lead.email}</p>
                      <p className="text-sm text-muted-foreground">{lead.phone}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{lead.source}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="max-w-xs truncate block text-sm">{lead.address}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[lead.status]}>
                      {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {lead.matchConfidence !== null ? (
                      <span className="text-sm">{(lead.matchConfidence * 100).toFixed(0)}%</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{lead.createdAt}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
