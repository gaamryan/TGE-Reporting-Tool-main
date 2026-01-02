"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Check, X, ChevronRight, AlertCircle } from "lucide-react";

// Sample match candidates
const matchCandidates = [
  {
    id: "1",
    sourceLead: {
      email: "john.smith@email.com",
      name: "John Smith",
      phone: "(555) 123-4567",
      address: "123 Main St, Austin, TX",
      source: "Zillow",
    },
    fubLead: {
      email: "johnsmith@email.com",
      name: "John D. Smith",
      phone: "(555) 123-4567",
      address: "123 Main Street, Austin, TX 78701",
      assignedTo: "Sarah Agent",
      stage: "Active",
    },
    confidence: 0.89,
    matchReasons: [
      { type: "phone_exact", score: 1.0 },
      { type: "address_fuzzy", score: 0.92 },
      { type: "name_fuzzy", score: 0.75 },
    ],
  },
  {
    id: "2",
    sourceLead: {
      email: "jane.doe@gmail.com",
      name: "Jane Doe",
      phone: "(555) 234-5678",
      address: "456 Oak Ave, Austin, TX",
      source: "Realtor.com",
    },
    fubLead: {
      email: "jdoe@yahoo.com",
      name: "Jane M. Doe",
      phone: "(555) 234-5678",
      address: "456 Oak Avenue, Austin, TX 78702",
      assignedTo: "Mike Agent",
      stage: "New",
    },
    confidence: 0.78,
    matchReasons: [
      { type: "phone_exact", score: 1.0 },
      { type: "address_fuzzy", score: 0.85 },
      { type: "name_fuzzy", score: 0.65 },
    ],
  },
  {
    id: "3",
    sourceLead: {
      email: "bob.wilson@email.com",
      name: "Bob Wilson",
      phone: "(555) 345-6789",
      address: "789 Pine Rd, Austin, TX",
      source: "OpCity",
    },
    fubLead: {
      email: "bob.wilson@email.com",
      name: "Robert Wilson",
      phone: "(555) 999-8888",
      address: "790 Pine Road, Austin, TX 78703",
      assignedTo: "Lisa Agent",
      stage: "Active",
    },
    confidence: 0.65,
    matchReasons: [
      { type: "email_exact", score: 1.0 },
      { type: "address_fuzzy", score: 0.72 },
      { type: "phone_mismatch", score: 0.0 },
    ],
  },
];

export default function MatchesPage() {
  const [candidates, setCandidates] = useState(matchCandidates);
  const [selectedId, setSelectedId] = useState<string | null>(candidates[0]?.id || null);

  const selectedCandidate = candidates.find((c) => c.id === selectedId);

  const handleApprove = (id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) {
      setSelectedId(candidates.find((c) => c.id !== id)?.id || null);
    }
  };

  const handleReject = (id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) {
      setSelectedId(candidates.find((c) => c.id !== id)?.id || null);
    }
  };

  const getProgressColor = (value: number): "green" | "yellow" | "red" => {
    if (value > 0.8) return "green";
    if (value > 0.6) return "yellow";
    return "red";
  };

  return (
    <div className="flex h-full">
      {/* Left panel - Candidate list */}
      <div className="w-96 border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">Match Review</h1>
          <p className="text-sm text-muted-foreground">
            {candidates.length} pending review{candidates.length !== 1 ? "s" : ""}
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {candidates.map((candidate) => (
              <Card
                key={candidate.id}
                className={`cursor-pointer transition-colors ${
                  selectedId === candidate.id
                    ? "ring-2 ring-primary"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => setSelectedId(candidate.id)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {candidate.sourceLead.name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {candidate.sourceLead.email}
                      </p>
                      <Badge variant="secondary" className="mt-2">
                        {candidate.sourceLead.source}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-lg">
                        {(candidate.confidence * 100).toFixed(0)}%
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {candidates.length === 0 && (
              <div className="text-center py-12">
                <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm text-muted-foreground">
                  No matches pending review
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right panel - Match details */}
      <div className="flex-1 flex flex-col">
        {selectedCandidate ? (
          <>
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Match Comparison</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">Confidence:</span>
                  <Progress
                    value={selectedCandidate.confidence * 100}
                    color={getProgressColor(selectedCandidate.confidence)}
                    className="w-32"
                  />
                  <span className="font-bold text-sm">
                    {(selectedCandidate.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleReject(selectedCandidate.id)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button onClick={() => handleApprove(selectedCandidate.id)}>
                  <Check className="h-4 w-4 mr-2" />
                  Approve Match
                </Button>
              </div>
            </div>

            {/* Comparison */}
            <div className="flex-1 p-6 overflow-auto">
              <div className="grid grid-cols-2 gap-6">
                {/* Source Lead */}
                <Card>
                  <CardHeader>
                    <CardTitle>Source Lead</CardTitle>
                    <Badge variant="secondary">
                      {selectedCandidate.sourceLead.source}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">
                        {selectedCandidate.sourceLead.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">
                        {selectedCandidate.sourceLead.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">
                        {selectedCandidate.sourceLead.phone}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">
                        {selectedCandidate.sourceLead.address}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* FUB Lead */}
                <Card>
                  <CardHeader>
                    <CardTitle>FUB Lead</CardTitle>
                    <Badge className="bg-green-100 text-green-800">
                      {selectedCandidate.fubLead.stage}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">
                        {selectedCandidate.fubLead.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">
                        {selectedCandidate.fubLead.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">
                        {selectedCandidate.fubLead.phone}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">
                        {selectedCandidate.fubLead.address}
                      </p>
                    </div>
                    <Separator className="my-2" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Assigned To
                      </p>
                      <p className="font-medium">
                        {selectedCandidate.fubLead.assignedTo}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Match reasons */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Match Signals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedCandidate.matchReasons.map((reason, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {reason.score > 0.8 ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : reason.score > 0.5 ? (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <X className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm">
                          {reason.type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={reason.score * 100}
                          color={getProgressColor(reason.score)}
                          className="w-24"
                        />
                        <span className="w-12 text-right text-sm">
                          {(reason.score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="font-medium">Select a match to review</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
