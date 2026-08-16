"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  buildNotionHandoffAuthUrl,
  copyNotionHandoffAuthUrl,
} from "@/lib/notion-connect-session";

const SAFARI_GUIDE_STEPS = [
  "아래 「연결 주소 복사」 버튼을 누릅니다.",
  "Safari 주소창을 길게 눌러 붙여 넣고 이동합니다.",
  "Notion 계정 승인과 데이터베이스 선택을 완료합니다.",
  "홈 화면 앱 아이콘을 눌러 돌아옵니다.",
] as const;

export default function NotionConnectSafariGuidePage() {
  const [handoffId, setHandoffId] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setHandoffId(params.get("handoff"));
  }, []);

  const authUrl = useMemo(() => {
    if (!handoffId) {
      return "";
    }

    return buildNotionHandoffAuthUrl(handoffId);
  }, [handoffId]);

  const handleCopyAuthUrl = async () => {
    if (!handoffId) {
      return;
    }

    const copied = await copyNotionHandoffAuthUrl(handoffId);
    setUrlCopied(copied);
    setCopyFailed(!copied);
  };

  if (!handoffId) {
    return (
      <main className="min-h-screen bg-[#f5f3ef] flex items-center justify-center px-4">
        <div className="max-w-sm w-full space-y-2 text-center">
          <h1 className="text-lg font-semibold text-stone-800">
            연결 정보를 찾을 수 없어요
          </h1>
          <p className="text-sm text-stone-600">
            홈 화면 앱에서 Notion 연결을 다시 시작해 주세요.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f3ef] flex items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Notion 연결
        </p>
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-stone-800">
            Safari 주소창에 연결 주소를 붙여 넣어 주세요
          </h1>
          <p className="text-sm text-stone-600">
            연결 주소는 Safari <strong>주소창</strong>에 붙여 넣어 주세요.
            메모·메시지 링크로 연결 주소를 열면 Notion 앱으로 넘어갈 수
            있습니다.
          </p>
        </div>

        <ol className="text-left space-y-2 w-full">
          {SAFARI_GUIDE_STEPS.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm text-stone-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-700">
                {index + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>

        <div className="space-y-2 w-full">
          {copyFailed && !urlCopied && (
            <p className="text-xs text-amber-800">
              연결 주소를 복사하지 못했습니다. 다시 시도해 주세요.
            </p>
          )}
          {urlCopied && (
            <p className="text-xs text-green-800">연결 주소를 복사했어요.</p>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void handleCopyAuthUrl();
            }}
            className="w-full border-stone-300 text-stone-700"
          >
            {urlCopied ? "다시 복사" : "연결 주소 복사"}
          </Button>
          {authUrl && (
            <p className="text-xs text-stone-500 break-all">{authUrl}</p>
          )}
        </div>
      </div>
    </main>
  );
}
