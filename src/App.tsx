import React, { useCallback, useMemo, useState } from "react";
import JSZip from "jszip";
import { QRCodeSVG } from "qrcode.react";
import { Upload, Ticket, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import * as htmlToImage from "html-to-image";

interface Barcode {
  message: string;
  format: string;
  altText?: string;
}

interface PassField {
  key: string;
  label?: string;
  value: string | number;
}

interface FieldGroup {
  primaryFields?: PassField[];
  secondaryFields?: PassField[];
  auxiliaryFields?: PassField[];
}

interface PassData {
  description: string;
  formatVersion: number;
  organizationName: string;
  passTypeIdentifier: string;
  serialNumber: string;
  teamIdentifier: string;

  backgroundColor?: string;
  foregroundColor?: string;
  labelColor?: string;
  logoText?: string;

  barcodes?: Barcode[];

  eventTicket?: FieldGroup;
  boardingPass?: FieldGroup;
  coupon?: FieldGroup;
  generic?: FieldGroup;
}

export default function App() {
  const [passData, setPassData] = useState<PassData | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [error, setError] = useState("");

  const fields = useMemo<FieldGroup | null>(() => {
    if (!passData) return null;
    return (
      passData.eventTicket ||
      passData.boardingPass ||
      passData.coupon ||
      passData.generic ||
      null
    );
  }, [passData]);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        setError("");
        setLogoUrl(null);

        const zip = await JSZip.loadAsync(file);

        const jsonText = await zip.file("pass.json")?.async("string");
        if (!jsonText) throw new Error();

        setPassData(JSON.parse(jsonText));

        const logoFile =
          zip.file("logo@2x.png") ||
          zip.file("logo.png") ||
          zip.file("icon@2x.png") ||
          zip.file("icon.png");

        if (logoFile) {
          const blob = await logoFile.async("blob");
          const url = URL.createObjectURL(blob);
          setLogoUrl(url);
        }
      } catch {
        setError("This file is not a valid .pkpass archive.");
      }
    },
    [],
  );

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] pb-10">
      <main className="max-w-6xl mx-auto px-6 pt-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <span className="bg-black text-white p-2 rounded-xl">
              <Ticket size={22} />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">PKPASS Viewer</h1>
          </div>

          {passData && (
            <button
              onClick={() => setPassData(null)}
              className="flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-black"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          )}
        </div>

        {!passData ? (
          <UploadView onUpload={handleUpload} />
        ) : (
          <PassPreview passData={passData} fields={fields} logoUrl={logoUrl} />
        )}
      </main>

      <section className="max-w-3xl mx-auto px-6 mt-24 text-zinc-600 space-y-6">
        <h2 className="text-2xl font-bold text-black">
          Open and Preview Apple Wallet Passes Online
        </h2>

        <p>
          This free PKPASS viewer lets you open and preview Apple Wallet passes
          directly in your browser. Your pass never leaves your device.
        </p>

        <p>
          Supported pass types include boarding passes, event tickets, coupons,
          and generic Apple Wallet passes.
        </p>

        <h3 className="text-xl font-semibold text-black">
          Is this PKPASS viewer secure?
        </h3>

        <p>
          Yes. All processing happens locally in your browser. Files are never
          uploaded to a server.
        </p>
      </section>

      {error && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-4 rounded-2xl font-bold shadow-2xl">
          {error}
        </div>
      )}
    </div>
  );
}

function UploadView({
  onUpload,
}: {
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col items-center text-center space-y-8 pt-12">
      <h2 className="text-5xl font-extrabold tracking-tight">
        Apple Wallet <span className="text-zinc-400">Preview</span>
      </h2>
      <p className="text-lg text-zinc-500 max-w-xl">
        Upload a .pkpass file to preview how it appears in Apple Wallet.
      </p>

      <label className="w-full max-w-md h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-[2.5rem] bg-white cursor-pointer">
        <Upload className="w-10 h-10 text-zinc-400 mb-4" />
        <span className="font-bold text-zinc-600">Choose a .pkpass file</span>
        <input
          type="file"
          className="hidden"
          accept=".pkpass"
          onChange={onUpload}
        />
      </label>
    </div>
  );
}

function PassPreview({
  passData,
  fields,
  logoUrl,
}: {
  passData: PassData;
  fields: FieldGroup | null;
  logoUrl: string | null;
}) {
  const passRef = React.useRef<HTMLDivElement>(null);

  const downloadAsImage = async () => {
    if (!passRef.current) return;

    try {
      const dataUrl = await htmlToImage.toPng(passRef.current, {
        backgroundColor: passData.backgroundColor || "#ffffff",
        pixelRatio: 3,
      });

      const link = document.createElement("a");
      link.download = `${passData.serialNumber || "pkpass"}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to export image", err);
    }
  };

  return (
    <div className="flex justify-center items-center flex-col ">
      <div className="flex justify-center mb-6">
        <button
          onClick={downloadAsImage}
          className="inline-flex items-center gap-2 rounded-full bg-black/5 px-5 py-2 text-sm font-semibold text-zinc-700 hover:bg-black/10 hover:text-black transition"
        >
          Download image
        </button>
      </div>

      <div
        ref={passRef}
        className="rounded-[3rem] overflow-hidden ring-1 ring-black/10 shadow-2xl"
      >
        <Card
          className="w-full max-w-sm rounded-[3rem] overflow-hidden"
          style={{
            backgroundColor: passData.backgroundColor || "#fff",
            color: passData.foregroundColor || "#000",
          }}
        >
          <CardHeader className="pt-10 pb-6 px-8 flex gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Pass logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <Ticket size={22} />
              )}
            </div>

            <div className="flex-1 overflow-hidden">
              <p
                className="text-[10px] font-black uppercase opacity-70 truncate"
                style={{ color: passData.labelColor }}
              >
                {passData.organizationName}
              </p>
              <CardTitle className="text-lg font-bold truncate">
                {passData.logoText || passData.description}
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-10 space-y-8">
            {fields?.primaryFields && (
              <div className="flex justify-between py-6 border-y border-black/10">
                {fields.primaryFields.map((f) => (
                  <div key={f.key}>
                    <p
                      className="text-[10px] font-bold uppercase opacity-60"
                      style={{ color: passData.labelColor }}
                    >
                      {f.label}
                    </p>
                    <p className="text-4xl font-black tracking-tight">
                      {f.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-y-6">
              {[
                ...(fields?.secondaryFields || []),
                ...(fields?.auxiliaryFields || []),
              ]
                .slice(0, 4)
                .map((f) => (
                  <div key={f.key}>
                    <p
                      className="text-[10px] font-bold uppercase opacity-60"
                      style={{ color: passData.labelColor }}
                    >
                      {f.label}
                    </p>
                    <p className="font-semibold text-sm truncate">{f.value}</p>
                  </div>
                ))}
            </div>

            {passData.barcodes?.[0] && (
              <div className="mt-4 p-6 bg-white rounded-[2rem] flex justify-center">
                <QRCodeSVG
                  value={passData.barcodes[0].message}
                  size={160}
                  level="H"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
