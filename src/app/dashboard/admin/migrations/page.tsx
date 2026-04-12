"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface MigrationStatus {
  applied: string[];
  pending: string[];
  total: number;
}

interface RunResult {
  file: string;
  status: string;
}

export default function MigrationsPage() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runningFile, setRunningFile] = useState<string | null>(null);
  const [results, setResults] = useState<RunResult[]>([]);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/migrate");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setStatus(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const runAll = async () => {
    setRunning(true);
    setResults([]);
    setRunningFile(null);
    try {
      const res = await fetch("/api/admin/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setResults(data.results || []);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const runOne = async (file: string) => {
    setRunningFile(file);
    setResults([]);
    try {
      const res = await fetch("/api/admin/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file }),
      });
      const data = await res.json();
      setResults(data.results || []);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunningFile(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Database Migrations</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
            <Button className="mt-4" variant="outline" onClick={fetchStatus}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Database Migrations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage database schema changes
          </p>
        </div>
        {status && status.pending.length > 0 && (
          <Button onClick={runAll} disabled={running}>
            {running ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Run All Pending ({status.pending.length})
          </Button>
        )}
      </div>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.file} className="flex items-center gap-2 text-sm">
                  {r.status === "applied" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : r.status === "already applied" ? (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="font-mono text-xs">{r.file}</span>
                  <span className="text-muted-foreground">{r.status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {status && status.pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Pending
              <Badge variant="secondary" className="ml-2">{status.pending.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {status.pending.map((file) => (
                <div key={file} className="flex items-center justify-between rounded-md border p-3">
                  <span className="font-mono text-sm">{file}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={runningFile === file}
                    onClick={() => runOne(file)}
                  >
                    {runningFile === file ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="mr-1 h-3 w-3" />
                    )}
                    Run
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Applied
            {status && <Badge variant="secondary" className="ml-2">{status.applied.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {status && status.applied.length > 0 ? (
            <div className="space-y-1">
              {status.applied.map((file) => (
                <div key={file} className="flex items-center gap-2 text-sm py-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-mono text-xs">{file}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No migrations have been applied yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
