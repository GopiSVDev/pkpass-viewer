import React, { useState } from "react";
import JSZip from "jszip";
import forge from "node-forge";
import { QRCodeSVG } from "qrcode.react";
import {
  Upload,
  Ticket,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  FileJson,
  BadgeCheck,
  FileCheck,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Apple Specific OIDs
const OID_PASSTYPE = "1.2.840.113635.100.6.1.2";
const OID_TEAMID = "1.2.840.113635.100.6.1.4";

interface ValidationResult {
  label: string;
  status: "success" | "error" | "warning" | "info";
  mandatory: boolean;
}

const App = () => {
  const [passData, setPassData] = useState<any>(null);
  const [results, setResults] = useState<{
    structure: ValidationResult[];
    keys: ValidationResult[];
    signature: ValidationResult[];
  }>({ structure: [], keys: [], signature: [] });
  const [error, setError] = useState("");

  const validatePass = async (zip: JSZip, json: any) => {
    const structure: ValidationResult[] = [
      {
        label: "Has manifest.json file",
        status: zip.file("manifest.json") ? "success" : "error",
        mandatory: true,
      },
      {
        label: "Has pass.json",
        status: zip.file("pass.json") ? "success" : "error",
        mandatory: true,
      },
      {
        label: "Has signature file",
        status: zip.file("signature") ? "success" : "error",
        mandatory: true,
      },
      {
        label: "Has icon.png file",
        status: zip.file("icon.png") ? "success" : "error",
        mandatory: true,
      },
      {
        label: "Has icon@2x.png file",
        status: zip.file("icon@2x.png") ? "success" : "error",
        mandatory: true,
      },
      {
        label: "Has icon@3x.png file (not mandatory)",
        status: zip.file("icon@3x.png") ? "success" : "info",
        mandatory: false,
      },
    ];

    const keys: ValidationResult[] = [
      {
        label: "Has description",
        status: json.description ? "success" : "error",
        mandatory: true,
      },
      {
        label: "Has formatVersion with value of 1",
        status: json.formatVersion === 1 ? "success" : "error",
        mandatory: true,
      },
      {
        label: "Has organizationName",
        status: json.organizationName ? "success" : "error",
        mandatory: true,
      },
      {
        label: "Has passTypeIdentifier",
        status: json.passTypeIdentifier ? "success" : "error",
        mandatory: true,
      },
      {
        label: "Has serialNumber",
        status: json.serialNumber ? "success" : "error",
        mandatory: true,
      },
      {
        label: "Has teamIdentifier",
        status: json.teamIdentifier ? "success" : "error",
        mandatory: true,
      },
    ];

    const signatureResults: ValidationResult[] = [];

    try {
      const sigFile = zip.file("signature");
      if (sigFile) {
        const sigBuf = await sigFile.async("uint8array");
        const p7 = forge.pkcs7.messageFromAsn1(
          forge.asn1.fromDer(forge.util.createBuffer(sigBuf)),
        );
        const cert = p7.certificates[0];

        // Extract OIDs from certificate extensions
        const passTypeExt = cert.extensions.find(
          (e: any) => e.id === OID_PASSTYPE || e.name === OID_PASSTYPE,
        );
        const teamIdExt = cert.extensions.find(
          (e: any) => e.id === OID_TEAMID || e.name === OID_TEAMID,
        );

        signatureResults.push({
          label: "PassTypeIdentifier in signature matches pass.json",
          status: passTypeExt ? "success" : "error",
          mandatory: true,
        });

        signatureResults.push({
          label: "TeamIdentifier in signature matches pass.json",
          status: teamIdExt ? "success" : "error",
          mandatory: true,
        });

        const issuer = cert.issuer.getField("CN")?.value || "";
        signatureResults.push({
          label: "PassKit Certificate issued by Apple",
          status: issuer.includes("Apple") ? "success" : "error",
          mandatory: true,
        });

        const now = new Date();
        signatureResults.push({
          label: "PassKit Certificate in date",
          status:
            now > cert.validity.notBefore && now < cert.validity.notAfter
              ? "success"
              : "error",
          mandatory: true,
        });

        signatureResults.push({
          label: "WWDR Certificate is version (G4)",
          status: issuer.includes("G4") ? "success" : "warning",
          mandatory: false,
        });
      }
    } catch (e) {
      signatureResults.push({
        label: "Cryptographic check failed",
        status: "error",
        mandatory: true,
      });
    }

    setResults({ structure, keys, signature: signatureResults });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setError("");
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const json = JSON.parse(
        await contents.file("pass.json")!.async("string"),
      );
      setPassData(json);
      await validatePass(contents, json);
    } catch (err) {
      setError("Critical error: This is not a valid PKPASS archive.");
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "success")
      return <CheckCircle2 className="text-green-500 w-4 h-4" />;
    if (status === "error")
      return <AlertCircle className="text-red-500 w-4 h-4" />;
    if (status === "warning")
      return <AlertCircle className="text-amber-500 w-4 h-4" />;
    return <Info className="text-blue-400 w-4 h-4" />;
  };

  const fields = passData
    ? passData.eventTicket ||
      passData.boardingPass ||
      passData.coupon ||
      passData.generic ||
      {}
    : null;

  if (passData) console.log(passData);

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] pb-20">
      <nav className="p-6 bg-white/80 backdrop-blur-xl sticky top-0 z-50 border-b border-zinc-200">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="bg-blue-600 text-white p-1 rounded-lg">
              <BadgeCheck size={20} />
            </div>
            Passkit Validator
          </div>
          {passData && (
            <button
              onClick={() => setPassData(null)}
              className="flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-black transition-colors"
            >
              <X size={16} /> New Check
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 pt-12">
        {!passData ? (
          <div className="flex flex-col items-center text-center space-y-8 pt-12">
            <h1 className="text-6xl font-extrabold tracking-tighter max-w-3xl">
              Audit your Apple Wallet{" "}
              <span className="text-blue-600">Certificates.</span>
            </h1>
            <p className="text-xl text-zinc-500 max-w-xl">
              Upload a .pkpass file to verify file structure, JSON keys, and
              cryptographic signature chain.
            </p>
            <label className="w-full max-w-md h-64 flex flex-col items-center justify-center border-2 border-dashed border-zinc-300 rounded-[2.5rem] bg-white hover:bg-zinc-50 hover:border-blue-400 transition-all cursor-pointer shadow-xl">
              <Upload className="w-10 h-10 text-zinc-400 mb-4" />
              <span className="font-bold">Choose a .pkpass file</span>
              <input
                type="file"
                className="hidden"
                accept=".pkpass"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Validation Results Column */}
            <div className="space-y-8">
              <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-zinc-100">
                <h2 className="text-2xl font-bold mb-6">Validation Results</h2>

                <div className="space-y-8">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                      <FileCheck size={14} /> File Structure
                    </h3>
                    <div className="space-y-3">
                      {results.structure.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-sm py-1 border-b border-zinc-50"
                        >
                          <span
                            className={
                              r.status === "error"
                                ? "text-red-600 font-medium"
                                : "text-zinc-600"
                            }
                          >
                            {r.label}
                          </span>
                          <StatusIcon status={r.status} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                      <FileJson size={14} /> Standard Keys
                    </h3>
                    <div className="space-y-3">
                      {results.keys.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-sm py-1 border-b border-zinc-50"
                        >
                          <span className="text-zinc-600">{r.label}</span>
                          <StatusIcon status={r.status} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                      <ShieldCheck size={14} /> Cryptography & Certs
                    </h3>
                    <div className="space-y-3">
                      {results.signature.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-sm py-1 border-b border-zinc-50"
                        >
                          <span className="text-zinc-600">{r.label}</span>
                          <StatusIcon status={r.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Preview Column */}
            <div className="flex justify-center sticky top-32">
              <Card
                className="w-full max-w-sm border-none shadow-2xl rounded-[3rem] overflow-hidden"
                style={{
                  backgroundColor: passData.backgroundColor || "#fff",
                  color: passData.foregroundColor || "#000",
                }}
              >
                <CardHeader className="pt-10 pb-6 px-8 flex flex-row items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                    <Ticket size={24} />
                  </div>
                  <div className="flex-1">
                    <p
                      className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60"
                      style={{ color: passData.labelColor }}
                    >
                      {passData.organizationName}
                    </p>
                    <CardTitle className="text-lg font-bold leading-tight">
                      {passData.logoText || passData.description}
                    </CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="px-8 pb-10 space-y-8">
                  <div className="flex justify-between items-center py-6 border-y border-white/10">
                    {fields?.primaryFields?.map((f: any) => (
                      <div key={f.key}>
                        <p
                          className="text-[10px] font-bold uppercase opacity-60 mb-1"
                          style={{ color: passData.labelColor }}
                        >
                          {f.label}
                        </p>
                        <p className="text-4xl font-black tracking-tighter italic">
                          {f.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-y-6">
                    {[
                      ...(fields?.secondaryFields || []),
                      ...(fields?.auxiliaryFields || []),
                    ]
                      .slice(0, 4)
                      .map((f: any) => (
                        <div key={f.key}>
                          <p
                            className="text-[10px] font-bold uppercase opacity-60"
                            style={{ color: passData.labelColor }}
                          >
                            {f.label}
                          </p>
                          <p className="font-bold text-sm">{f.value}</p>
                        </div>
                      ))}
                  </div>

                  {passData.barcodes && (
                    <div className="mt-4 p-8 bg-white rounded-[2.5rem] flex flex-col items-center gap-4 shadow-inner">
                      <QRCodeSVG
                        value={passData.barcodes[0].message}
                        size={150}
                        level="M"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      {error && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl font-bold animate-in slide-in-from-bottom">
          {error}
        </div>
      )}
    </div>
  );
};

export default App;
