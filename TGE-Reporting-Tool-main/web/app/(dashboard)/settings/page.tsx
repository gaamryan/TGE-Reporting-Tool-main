"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, Users, Plug, Bell, Shield } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization and integrations
        </p>
      </div>

      <div className="space-y-6">
        {/* Organization */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Organization</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Organization Name</label>
              <Input defaultValue="Acme Realty" className="mt-1.5 max-w-md" />
            </div>
            <div>
              <label className="text-sm font-medium">Slug</label>
              <Input defaultValue="acme-realty" className="mt-1.5 max-w-md" disabled />
              <p className="text-xs text-muted-foreground mt-1">Used in URLs and API calls</p>
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Team Members</CardTitle>
              </div>
              <Button variant="outline">Invite Member</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "John Doe", email: "john@acmerealty.com", role: "Admin" },
                { name: "Jane Smith", email: "jane@acmerealty.com", role: "Member" },
                { name: "Bob Wilson", email: "bob@acmerealty.com", role: "Member" },
              ].map((member, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge variant={member.role === "Admin" ? "default" : "secondary"}>
                    {member.role}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Plug className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Integrations</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Follow Up Boss */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">Follow Up Boss</p>
                  <p className="text-sm text-muted-foreground">
                    Connected - Last sync 5 minutes ago
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </div>

            {/* Lead Sources */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">Lead Sources</p>
                  <p className="text-sm text-muted-foreground">
                    5 sources configured (Zillow, Realtor.com, OpCity, Ylopo, Generic)
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">Manage Sources</Button>
            </div>

            {/* Email Ingest */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Bell className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium">Email Ingest</p>
                  <p className="text-sm text-muted-foreground">
                    Forward CSVs to zillow@ingest.tge-app.com
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">View Addresses</Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Notifications</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Daily summary email", description: "Receive a summary of lead activity", enabled: true },
                { label: "Match review alerts", description: "Get notified when matches need review", enabled: true },
                { label: "Anomaly detection", description: "Alert when unusual patterns are detected", enabled: false },
                { label: "Weekly reports", description: "Receive weekly performance reports", enabled: true },
              ].map((setting, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">{setting.label}</p>
                    <p className="text-sm text-muted-foreground">{setting.description}</p>
                  </div>
                  <Button variant={setting.enabled ? "default" : "outline"} size="sm">
                    {setting.enabled ? "Enabled" : "Disabled"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete Organization</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this organization and all its data
                </p>
              </div>
              <Button variant="destructive">Delete Organization</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
