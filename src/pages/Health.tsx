import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Health() {
  const [supabaseStatus, setSupabaseStatus] = useState<"ok" | "error" | "loading">("loading");
  const [envStatus, setEnvStatus] = useState<"ok" | "error">("ok");

  useEffect(() => {
    // Check if env vars are present
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      setEnvStatus("error");
    }

    // Try a simple Supabase query
    supabase
      .from("fuel_tanks") // or any table you know exists
      .select("id")
      .limit(1)
      .then(({ error }) => {
        setSupabaseStatus(error ? "error" : "ok");
      })
      .catch(() => setSupabaseStatus("error"));
  }, []);

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Health Check</h1>
      <ul className="space-y-2">
        <li>
          <span className="font-semibold">Frontend:</span>{" "}
          <span className="text-green-600">OK</span>
        </li>
        <li>
          <span className="font-semibold">Supabase:</span>{" "}
          {supabaseStatus === "loading" ? (
            <span className="text-gray-500">Checking...</span>
          ) : supabaseStatus === "ok" ? (
            <span className="text-green-600">OK</span>
          ) : (
            <span className="text-red-600">Error</span>
          )}
        </li>
        <li>
          <span className="font-semibold">Env Vars:</span>{" "}
          {envStatus === "ok" ? (
            <span className="text-green-600">OK</span>
          ) : (
            <span className="text-red-600">Missing</span>
          )}
        </li>
      </ul>
    </div>
  );
} 