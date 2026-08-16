"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isIOS, toSafariSchemeUrl } from "@/lib/is-standalone-pwa";
import {
  beginNotionConnectFlow,
  clearNotionConnectSession,
  copyNotionHandoffAuthUrl,
  didNotionHandoffAuthUrlCopyFail,
  markConnectFlowStarted,
  markSafariGuideLaunch,
  NOTION_CONNECT_HANDOFF_ID_KEY,
  NOTION_CONNECT_HANDOFF_LAUNCHED_KEY,
  isHandoffAttemptExpired,
  SAFARI_GUIDE_FALLBACK_DELAY_MS,
  startNotionConnectHandoff,
  wasNotionHandoffAuthUrlCopied,
  wasSafariGuideLaunched,
} from "@/lib/notion-connect-session";
import {
  mapConnectionToUiStatus,
  type NotionConnectUiStatus,
} from "@/lib/notion-connect-ui-status";

type ConnectionState = {
  loading: boolean;
  notionConnected: boolean;
  dbConnected: boolean;
};

function StatusLayout({
  step,
  title,
  description,
  hint,
  children,
}: {
  step?: string;
  title: string;
  description: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f5f3ef] flex items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-4 text-center">
        {step && (
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            {step}
          </p>
        )}
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-stone-800">{title}</h1>
          <p className="text-sm text-stone-600">{description}</p>
          {hint && <p className="text-xs text-stone-500">{hint}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}

function CopyAuthUrlButton({
  urlCopied,
  autoCopyFailed,
  onCopyAuthUrl,
}: {
  urlCopied: boolean;
  autoCopyFailed: boolean;
  onCopyAuthUrl: () => void;
}) {
  return (
    <div className="space-y-2 w-full">
      {autoCopyFailed && !urlCopied && (
        <p className="text-xs text-amber-800">
          연결 주소를 자동으로 복사하지 못했습니다. 아래 버튼을 눌러 주세요.
        </p>
      )}
      {urlCopied && (
        <p className="text-xs text-green-800">연결 주소를 복사했어요.</p>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={onCopyAuthUrl}
        className="w-full border-stone-300 text-stone-700"
      >
        {urlCopied ? "다시 복사" : "연결 주소 복사"}
      </Button>
    </div>
  );
}

function RecoveryActions({
  onRetry,
  onGoHome,
  retryLabel = "다시 연결하기",
}: {
  onRetry: () => void;
  onGoHome: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="space-y-2 w-full">
      <Button
        onClick={onRetry}
        className="w-full bg-stone-800 hover:bg-stone-900 text-white"
      >
        {retryLabel}
      </Button>
      <Button
        onClick={onGoHome}
        variant="outline"
        className="w-full border-stone-300 text-stone-700"
      >
        앱 홈으로 이동
      </Button>
    </div>
  );
}

export default function NotionConnectPage() {
  const router = useRouter();
  const [handoffId, setHandoffId] = useState<string | null>(null);
  const [connectFlowStarted, setConnectFlowStarted] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>({
    loading: false,
    notionConnected: false,
    dbConnected: false,
  });
  const [fetchError, setFetchError] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [autoCopyFailed, setAutoCopyFailed] = useState(false);
  const [showSafariGuideFallback, setShowSafariGuideFallback] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlHandoff = params.get("handoff");
    let resolvedHandoffId: string | null = null;

    if (urlHandoff) {
      sessionStorage.setItem(NOTION_CONNECT_HANDOFF_ID_KEY, urlHandoff);
      window.history.replaceState({}, "", "/notion/connect");
      resolvedHandoffId = urlHandoff;
    } else {
      resolvedHandoffId = sessionStorage.getItem(NOTION_CONNECT_HANDOFF_ID_KEY);
    }

    if (resolvedHandoffId) {
      if (sessionStorage.getItem(NOTION_CONNECT_HANDOFF_LAUNCHED_KEY) !== "1") {
        markConnectFlowStarted(resolvedHandoffId);
      }
      setConnectFlowStarted(true);
      setHandoffId(resolvedHandoffId);
    } else {
      setHandoffId(null);
      setConnectFlowStarted(false);
    }

    setInitialized(true);
    setUrlCopied(wasNotionHandoffAuthUrlCopied());
    setAutoCopyFailed(didNotionHandoffAuthUrlCopyFail());
  }, []);

  const safariGuideUrl = useMemo(() => {
    if (!handoffId || typeof window === "undefined") {
      return "";
    }

    const guideUrl = `${window.location.origin}/notion/connect/safari-guide?handoff=${encodeURIComponent(handoffId)}`;
    return isIOS() ? toSafariSchemeUrl(guideUrl) : guideUrl;
  }, [handoffId]);

  useEffect(() => {
    if (
      !initialized ||
      !connectFlowStarted ||
      !handoffId ||
      !safariGuideUrl ||
      !isIOS()
    ) {
      return;
    }

    if (wasSafariGuideLaunched()) {
      return;
    }

    markSafariGuideLaunch();
    window.location.replace(safariGuideUrl);
  }, [initialized, connectFlowStarted, handoffId, safariGuideUrl]);

  useEffect(() => {
    if (
      !initialized ||
      !connectFlowStarted ||
      !isIOS() ||
      !wasSafariGuideLaunched() ||
      connection.notionConnected ||
      connection.dbConnected
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        setShowSafariGuideFallback(true);
      }
    }, SAFARI_GUIDE_FALLBACK_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    initialized,
    connectFlowStarted,
    connection.notionConnected,
    connection.dbConnected,
  ]);

  const fetchConnection = useCallback(async () => {
    setConnection((prev) => ({ ...prev, loading: true }));
    setFetchError(false);

    try {
      const response = await fetch("/api/notion/connection");
      const data = await response.json();

      if (
        data.notionConnected !== undefined &&
        data.dbConnected !== undefined
      ) {
        setConnection({
          loading: false,
          notionConnected: data.notionConnected,
          dbConnected: data.dbConnected,
        });

        if (data.dbConnected) {
          clearNotionConnectSession();
        }

        return;
      }

      setConnection({
        loading: false,
        notionConnected: false,
        dbConnected: false,
      });
    } catch (error) {
      console.error("Notion connection status check failed:", error);
      setFetchError(true);
      setConnection((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    if (!initialized || !connectFlowStarted) {
      return;
    }

    void fetchConnection();

    const syncConnection = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void fetchConnection();
    };

    document.addEventListener("visibilitychange", syncConnection);
    window.addEventListener("focus", syncConnection);
    window.addEventListener("pageshow", syncConnection);

    return () => {
      document.removeEventListener("visibilitychange", syncConnection);
      window.removeEventListener("focus", syncConnection);
      window.removeEventListener("pageshow", syncConnection);
    };
  }, [initialized, connectFlowStarted, fetchConnection]);

  const uiStatus: NotionConnectUiStatus = useMemo(() => {
    if (!initialized) {
      return "starting";
    }

    if (!handoffId || fetchError) {
      return "failed";
    }

    if (!connectFlowStarted) {
      return "starting";
    }

    if (
      !connection.loading &&
      !connection.notionConnected &&
      !connection.dbConnected &&
      isHandoffAttemptExpired()
    ) {
      return "expired";
    }

    if (connection.loading) {
      return "handoff_started";
    }

    return mapConnectionToUiStatus(
      connection.notionConnected,
      connection.dbConnected,
    );
  }, [
    initialized,
    handoffId,
    fetchError,
    connectFlowStarted,
    connection.loading,
    connection.notionConnected,
    connection.dbConnected,
  ]);

  const handleGoHome = () => {
    clearNotionConnectSession();
    router.push("/");
  };

  const handleRetryConnect = async () => {
    setIsRetrying(true);
    setRetryError("");

    try {
      clearNotionConnectSession();
      const newHandoffId = await startNotionConnectHandoff();
      beginNotionConnectFlow(newHandoffId);
      await copyNotionHandoffAuthUrl(newHandoffId);
      window.location.href = `/notion/connect?handoff=${newHandoffId}`;
    } catch (error) {
      console.error("Notion connect retry failed:", error);
      setRetryError(
        error instanceof Error
          ? error.message
          : "다시 연결을 시작하지 못했습니다.",
      );
      setIsRetrying(false);
    }
  };

  const handleCopyAuthUrl = async () => {
    if (!handoffId) {
      return;
    }

    const copied = await copyNotionHandoffAuthUrl(handoffId);
    setUrlCopied(copied);
    setAutoCopyFailed(!copied);
  };

  if (!initialized) {
    return (
      <StatusLayout
        title="연결 준비 중"
        description="Notion 연결 상태를 확인하고 있습니다."
      />
    );
  }

  if (uiStatus === "failed") {
    return (
      <StatusLayout
        title="연결을 완료하지 못했어요"
        description={
          !handoffId
            ? "OAuth handoff 정보가 없습니다. 다시 연결을 시작해 주세요."
            : "연결 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요."
        }
      >
        <RecoveryActions
          onRetry={() => {
            void handleRetryConnect();
          }}
          onGoHome={handleGoHome}
        />
        {retryError && <p className="text-xs text-red-700">{retryError}</p>}
        {isRetrying && (
          <p className="text-xs text-stone-500">
            다시 연결을 준비하고 있습니다...
          </p>
        )}
      </StatusLayout>
    );
  }

  if (uiStatus === "expired") {
    return (
      <StatusLayout
        title="연결을 완료하지 못했어요"
        description="연결 시도가 만료되었습니다. 처음부터 다시 연결해 주세요."
      >
        <RecoveryActions
          onRetry={() => {
            void handleRetryConnect();
          }}
          onGoHome={handleGoHome}
        />
        {retryError && <p className="text-xs text-red-700">{retryError}</p>}
        {isRetrying && (
          <p className="text-xs text-stone-500">
            다시 연결을 준비하고 있습니다...
          </p>
        )}
      </StatusLayout>
    );
  }

  if (uiStatus === "handoff_started") {
    return (
      <StatusLayout
        step="Notion 연결"
        title={
          connection.loading
            ? "연결 상태 확인 중"
            : "Safari에서 Notion 연결을 진행해 주세요"
        }
        description={
          connection.loading
            ? "Notion 연결 진행 상황을 확인하고 있습니다."
            : urlCopied
              ? "Safari 안내 페이지가 열렸습니다. 안내에 따라 주소창에 붙여 넣어 주세요."
              : "Safari 안내 페이지에서 연결 주소를 복사한 뒤 주소창에 붙여 넣어 주세요."
        }
        hint={
          connection.loading
            ? undefined
            : "연결이 끝나면 홈 화면 앱 아이콘으로 돌아오세요."
        }
      >
        {!connection.loading && (
          <div className="space-y-3 w-full">
            {showSafariGuideFallback &&
              isIOS() &&
              safariGuideUrl &&
              !connection.notionConnected &&
              !connection.dbConnected && (
                <a
                  href={safariGuideUrl}
                  className="inline-block w-full rounded-md bg-stone-800 px-4 py-2.5 text-sm text-white"
                >
                  Safari 안내 다시 열기
                </a>
              )}
            <CopyAuthUrlButton
              urlCopied={urlCopied}
              autoCopyFailed={autoCopyFailed}
              onCopyAuthUrl={() => {
                void handleCopyAuthUrl();
              }}
            />
          </div>
        )}
      </StatusLayout>
    );
  }

  if (uiStatus === "notion_authorized") {
    return (
      <StatusLayout
        step="Notion 계정 연결 완료"
        title="데이터베이스 선택이 남아 있어요"
        description="Notion 계정은 연결됐습니다. Safari로 돌아가 사용할 데이터베이스를 선택해 주세요."
        hint="데이터베이스 선택을 마친 뒤 홈 화면 앱 아이콘으로 돌아오세요."
      />
    );
  }

  return (
    <StatusLayout
      title="Notion 연결이 완료됐어요"
      description="Notion 계정과 데이터베이스가 모두 연결되었습니다."
    >
      <Button
        onClick={handleGoHome}
        className="w-full bg-stone-800 hover:bg-stone-900 text-white"
      >
        앱 홈으로 이동
      </Button>
    </StatusLayout>
  );
}
