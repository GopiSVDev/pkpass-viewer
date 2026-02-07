import React, { useCallback, useMemo, useState } from "react";
import JSZip from "jszip";
import forge from "node-forge";
import { QRCodeSVG } from "qrcode.react";
import {
  Upload,
  Ticket,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  FileJson,
  BadgeCheck,
  FileCheck,
  Info,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const OID_PASSTYPE = "1.2.840.113635.100.6.1.16";
const OID_TEAMID = "1.2.840.113635.100.6.1.4";

interface ForgeSignedData extends forge.pkcs7.PkcsSignedData {
  certificates: forge.pki.Certificate[];
}

interface Barcode {
  message: string;
  format: string;
  altText?: string;
  messageEncoding?: string;
}

interface PassField {
  key: string;
  label?: string;
  value: string | number;
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

interface FieldGroup {
  primaryFields?: PassField[];
  secondaryFields?: PassField[];
  auxiliaryFields?: PassField[];
}

interface ValidationResult {
  label: string;
  status: "success" | "error" | "warning" | "info";
  mandatory: boolean;
}

const statusIconMap = {
  success: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />,
  warning: <AlertCircle className="w-4 h-4 text-amber-500" />,
  info: <Info className="w-4 h-4 text-blue-400" />,
} as const;

const getOU = (cert: forge.pki.Certificate) =>
  cert.subject.attributes.find(
    (a) => a.name === "organizationalUnitName" || a.shortName === "OU",
  )?.value || "";

const sanitize = (value?: string) =>
  value ? value.replace(/[^\x20-\x7E]/g, "").trim() : "";

export default function App() {
  const [passData, setPassData] = useState<PassData | null>(null);
  const [error, setError] = useState("");
  const [results, setResults] = useState({
    structure: [] as ValidationResult[],
    keys: [] as ValidationResult[],
    signature: [] as ValidationResult[],
  });

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

  const validatePass = useCallback(async (zip: JSZip, json: PassData) => {
    const structure = [
      ["manifest.json", true],
      ["pass.json", true],
      ["signature", true],
      ["icon.png", true],
      ["icon@2x.png", true],
      ["icon@3x.png", false],
    ].map(([file, mandatory]) => ({
      label: `Has ${file} file${mandatory ? "" : " (not mandatory)"}`,
      status: zip.file(file) ? "success" : mandatory ? "error" : "info",
      mandatory,
    })) as ValidationResult[];

    const keys: ValidationResult[] = [
      ["description", !!json.description],
      ["formatVersion === 1", json.formatVersion === 1],
      ["organizationName", !!json.organizationName],
      ["passTypeIdentifier", !!json.passTypeIdentifier],
      ["serialNumber", !!json.serialNumber],
      ["teamIdentifier", !!json.teamIdentifier],
    ].map(([label, ok]) => ({
      label: `Has ${label}`,
      status: ok ? "success" : "error",
      mandatory: true,
    }));

    const signature: ValidationResult[] = [];

    try {
      const sig = zip.file("signature");
      if (!sig) throw new Error();

      const buffer = forge.util.createBuffer(
        (await sig.async("uint8array")) as any,
      );

      const asn1 = forge.asn1.fromDer(buffer);
      const p7 = forge.pkcs7.messageFromAsn1(
        asn1,
      ) as unknown as ForgeSignedData;

      const signerCert = p7.signers?.[0]?.certificate;
      if (!signerCert) throw new Error("Signer certificate missing");

      const passCert = p7.certificates.find(
        (c) =>
          c.subject.getField("CN")?.value?.startsWith("Pass Type ID:") ||
          c.subject.getField("CN")?.value?.startsWith("Pass Type ID with NFC:"),
      );

      const passTypeExt = passCert?.extensions.find(
        (e) => e.id === OID_PASSTYPE,
      );

      const decodeUTF8 = (v: string) => (v.length > 2 ? v.substring(2) : v);

      const certPassTypeIdentifier = decodeUTF8(passTypeExt?.value || "");
      const passTypeMatch = certPassTypeIdentifier === json.passTypeIdentifier;

      const teamIdFromCert = signerCert.subject.getField("OU")?.value || "";
      const teamIdMatch = teamIdFromCert === json.teamIdentifier;

      signature.push(
        {
          label: "PassTypeIdentifier matches signature",
          status: passTypeMatch ? "success" : "error",
          mandatory: true,
        },
        {
          label: "TeamIdentifier matches signature",
          status: teamIdMatch ? "success" : "error",
          mandatory: true,
        },
      );

      const issuerCN = signerCert.issuer.getField("CN")?.value || "";

      signature.push({
        label: "PassKit Certificate issued by Apple",
        status: issuerCN.includes("Apple") ? "success" : "error",
        mandatory: true,
      });

      const now = new Date();
      const valid =
        now > signerCert.validity.notBefore &&
        now < signerCert.validity.notAfter;

      signature.push({
        label: "PassKit Certificate in date",
        status: valid ? "success" : "error",
        mandatory: true,
      });

      const subjectOU = teamIdFromCert;

      const version =
        subjectOU.includes("G4") || issuerCN.includes("G4")
          ? "G4"
          : subjectOU.includes("G3")
            ? "G3"
            : "Unknown";

      signature.push({
        label: `WWDR Certificate version (${version})`,
        status: version === "Unknown" ? "warning" : "success",
        mandatory: false,
      });
    } catch {
      signature.push({
        label: "Cryptographic check failed",
        status: "error",
        mandatory: true,
      });
    }

    setResults({ structure, keys, signature });
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError("");
      const zip = await JSZip.loadAsync(file);
      const jsonText = await zip.file("pass.json")?.async("string");
      if (!jsonText) throw new Error();

      const json = JSON.parse(jsonText) as PassData;
      setPassData(json);
      validatePass(zip, json);
    } catch {
      setError("Critical error: This is not a valid PKPASS archive.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] pb-20">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto p-6 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl">
            <span className="bg-blue-600 text-white p-1 rounded-lg">
              <BadgeCheck size={20} />
            </span>
            PassKit Viewer & Validator
          </div>
          {passData && (
            <button
              onClick={() => setPassData(null)}
              className="flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-black"
            >
              <RotateCcw size={16} /> Reset
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 pt-12">
        {!passData ? (
          <UploadView onUpload={handleFileUpload} />
        ) : (
          <ResultView passData={passData} fields={fields} results={results} />
        )}
      </main>

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
      <h1 className="text-6xl font-extrabold tracking-tighter max-w-3xl">
        Professional Apple Wallet{" "}
        <span className="text-blue-600">Audit Tool.</span>
      </h1>
      <p className="text-xl text-zinc-500 max-w-xl">
        Inspect package contents, verify JSON standards, and validate
        cryptographic signatures.
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

function ResultView({
  passData,
  fields,
  results,
}: {
  passData: PassData;
  fields: FieldGroup | null;
  results: Record<string, ValidationResult[]>;
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-12 items-start">
      <ValidationPanel results={results} />
      <PassPreview passData={passData} fields={fields} />
    </div>
  );
}

function ValidationPanel({
  results,
}: {
  results: Record<string, ValidationResult[]>;
}) {
  return (
    <section className="bg-white p-8 rounded-[2rem] border">
      <h2 className="text-2xl font-bold mb-6">Validation Results</h2>
      {Object.entries(results).map(([key, group]) => (
        <div key={key} className="mb-8">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4 flex gap-2">
            {key === "structure" ? (
              <FileCheck size={14} />
            ) : key === "keys" ? (
              <FileJson size={14} />
            ) : (
              <ShieldCheck size={14} />
            )}
            {key}
          </h3>
          {group.map((r, i) => (
            <div key={i} className="flex justify-between text-sm py-1 border-b">
              <span
                className={
                  r.status === "error"
                    ? "text-red-600 font-medium"
                    : "text-zinc-600"
                }
              >
                {r.label}
              </span>
              {statusIconMap[r.status]}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

function PassPreview({
  passData,
  fields,
}: {
  passData: PassData;
  fields: FieldGroup | null;
}) {
  return (
    <div className="flex justify-center sticky top-32">
      <Card
        className="w-full max-w-sm shadow-2xl rounded-[3rem] overflow-hidden"
        style={{
          backgroundColor: passData.backgroundColor || "#fff",
          color: passData.foregroundColor || "#000",
        }}
      >
        <CardHeader className="pt-10 pb-6 px-8 flex gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <Ticket size={24} />
          </div>
          <div className="flex-1 overflow-hidden">
            <p
              className="text-[10px] font-black uppercase opacity-60 truncate"
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
          <div className="flex justify-between py-6 border-y">
            {fields?.primaryFields?.map((f) => (
              <div key={f.key}>
                <p
                  className="text-[10px] font-bold uppercase opacity-60"
                  style={{ color: passData.labelColor }}
                >
                  {f.label}
                </p>
                <p className="text-4xl font-black italic">{f.value}</p>
              </div>
            ))}
          </div>

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
                  <p className="font-bold text-sm">{f.value}</p>
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
  );
}
