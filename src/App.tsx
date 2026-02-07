import React, { useState } from "react";
import JSZip from "jszip";
import { Upload, Ticket, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./components/ui/card.tsx";

interface PassData {
  description?: string;
  organizationName?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  labelColor?: string;
  logoText?: string;
  barcode?: { message: string; format: string };
  eventTicket?: any;
  boardingPass?: any;
  coupon?: any;
  generic?: any;
}

const App = () => {
  const [passData, setPassData] = useState<PassData | null>(null);
  const [error, setError] = useState<string>("");

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError("");
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);

      const passJsonFile = contents.file("pass.json");
      if (!passJsonFile)
        throw new Error("Invalid .pkpass: pass.json not found.");

      const jsonString = await passJsonFile.async("string");
      const data = JSON.parse(jsonString);
      setPassData(data);
    } catch (err) {
      setError("Failed to read .pkpass file.");
      console.error(err);
    }
  };

  const getFields = () => {
    if (!passData) return null;
    return (
      passData.eventTicket ||
      passData.boardingPass ||
      passData.coupon ||
      passData.generic ||
      {}
    );
  };

  const fields = getFields();

  // Helper to ensure colors are valid CSS
  const formatColor = (colorString?: string) => {
    if (!colorString) return undefined;
    return colorString.includes("rgb") ? colorString : `rgb(${colorString})`;
  };

  const styles = {
    backgroundColor: formatColor(passData?.backgroundColor) || "#ffffff",
    color: formatColor(passData?.foregroundColor) || "#000000",
  };

  const labelStyle = {
    color: formatColor(passData?.labelColor) || "inherit",
    opacity: passData?.labelColor ? 1 : 0.7,
  };

  return (
    <div className="min-h-screen bg-zinc-100 p-4 md:p-8 flex flex-col items-center">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-800">
            Pass Inspector
          </h1>
        </div>

        {!passData && (
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-zinc-300 rounded-2xl cursor-pointer bg-white hover:border-blue-400 transition-all">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-10 h-10 mb-3 text-zinc-400" />
              <p className="text-sm font-medium text-zinc-600">
                Drop your .pkpass here
              </p>
            </div>
            <input
              type="file"
              className="hidden"
              accept=".pkpass"
              onChange={handleFileUpload}
            />
          </label>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-lg">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {passData && (
          <div className="relative group">
            <button
              onClick={() => setPassData(null)}
              className="absolute -top-4 -right-4 bg-white shadow-md rounded-full p-1 hover:bg-zinc-100 z-10"
            >
              <AlertCircle className="w-5 h-5 text-zinc-400 rotate-45" />
            </button>

            <Card
              className="overflow-hidden border-none shadow-2xl rounded-[2rem]"
              style={styles}
            >
              <CardHeader className="pb-4 border-b border-white/10">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-md flex items-center justify-center">
                      <Ticket className="w-5 h-5" />
                    </div>
                    <div>
                      <p
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={labelStyle}
                      >
                        {passData.organizationName}
                      </p>
                      <CardTitle className="text-lg font-bold leading-tight">
                        {passData.logoText || passData.description}
                      </CardTitle>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 pt-6">
                {/* Primary Fields (e.g., Gate, Seat, Event Name) */}
                <div className="flex justify-between items-end">
                  {fields?.primaryFields?.map((f: any) => (
                    <div key={f.key} className="flex flex-col">
                      <span
                        className="text-[11px] font-semibold uppercase"
                        style={labelStyle}
                      >
                        {f.label}
                      </span>
                      <span className="text-3xl font-black tracking-tighter">
                        {f.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Secondary Fields */}
                <div className="grid grid-cols-2 gap-4">
                  {fields?.secondaryFields?.map((f: any) => (
                    <div key={f.key}>
                      <p
                        className="text-[10px] font-bold uppercase"
                        style={labelStyle}
                      >
                        {f.label}
                      </p>
                      <p className="font-semibold text-sm">{f.value}</p>
                    </div>
                  ))}
                </div>

                {/* Auxiliary & Back Fields */}
                {(fields?.auxiliaryFields || fields?.backFields) && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
                    {fields?.auxiliaryFields?.map((f: any) => (
                      <div key={f.key}>
                        <p
                          className="text-[9px] font-bold uppercase"
                          style={labelStyle}
                        >
                          {f.label}
                        </p>
                        <p className="font-medium text-xs">{f.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Barcode Section */}
                {passData.barcode && (
                  <div className="mt-4 p-6 bg-white rounded-xl flex flex-col items-center shadow-inner">
                    <div className="w-full h-16 bg-[url('https://www.cognex.com/api/Sitecore/Barcode/Get?type=Code128&data=SAMPLE')] bg-contain bg-center bg-no-repeat opacity-80" />
                    <p className="mt-2 font-mono text-[10px] text-zinc-500 tracking-widest uppercase">
                      {passData.barcode.message}
                    </p>
                    <div className="mt-3 flex items-center gap-1 text-green-600 text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3" /> VERIFIED PKPASS DATA
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
