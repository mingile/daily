"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isIOS, toSafariSchemeUrl } from "@/lib/is-standalone-pwa";
import {
  beginNotionConnectFlow,
  clearNotionConnectSession,
  markHandoffLaunch,
  NOTION_CONNECT_HANDOFF_ID_KEY,
  NOTION_CONNECT_HANDOFF_LAUNCHED_KEY,
  isHandoffAttemptExpired,
  SAFARI_FALLBACK_DELAY_MS,
  startNotionConnectHandoff,
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

function SafariFallbackActions({
  safariAuthUrl,
  authUrl,
  urlCopied,
  onCopyAuthUrl,
}: {
  safariAuthUrl: string;
  authUrl: string;
  urlCopied: boolean;
  onCopyAuthUrl: () => void;
}) {
  if (!authUrl) {
    return null;
  }

  return (
    <div className="space-y-2 w-full">
      <p className="text-xs text-stone-500">
        Safari가 열리지 않으면 주소를 복사해 Safari 주소창에 붙여 넣어 주세요.
      </p>
      {isIOS() && safariAuthUrl && (
        <a
          href={safariAuthUrl}
          className="inline-block w-full rounded-md bg-stone-800 px-4 py-2 text-sm text-white"
        >
          Safari에서 다시 열기
        </a>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={onCopyAuthUrl}
        className="w-full border-stone-300 text-stone-700"
      >
        {urlCopied ? "주소를 복사했어요" : "연결 주소 복사"}
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
  const [handoffLaunched, setHandoffLaunched] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>({
    loading: false,
    notionConnected: false,
    dbConnected: false,
  });
  const [fetchError, setFetchError] = useState(false);
  const [showSafariFallback, setShowSafariFallback] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlHandoff = params.get("handoff");

    if (urlHandoff) {
      sessionStorage.setItem(NOTION_CONNECT_HANDOFF_ID_KEY, urlHandoff);
      window.history.replaceState({}, "", "/notion/connect");
      setHandoffId(urlHandoff);
    } else {
      setHandoffId(sessionStorage.getItem(NOTION_CONNECT_HANDOFF_ID_KEY));
    }

    setHandoffLaunched(
      sessionStorage.getItem(NOTION_CONNECT_HANDOFF_LAUNCHED_KEY) === "1",
    );
    setInitialized(true);
  }, []);

  const authUrl = useMemo(() => {
    if (!handoffId || typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}/api/notion/auth?handoff=${handoffId}`;
  }, [handoffId]);

  const safariAuthUrl = useMemo(() => {
    if (!authUrl) {
      return "";
    }

    return isIOS() ? toSafariSchemeUrl(authUrl) : authUrl;
  }, [authUrl]);

  const safariHomeUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const homeUrl = `${window.location.origin}/`;
    return isIOS() ? toSafariSchemeUrl(homeUrl) : homeUrl;
  }, []);

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
    if (!initialized || !handoffId || handoffLaunched || !safariAuthUrl) {
      return;
    }

    markHandoffLaunch(handoffId);
    setHandoffLaunched(true);
    window.location.replace(safariAuthUrl);
  }, [initialized, handoffId, handoffLaunched, safariAuthUrl]);

  useEffect(() => {
    if (!initialized || !handoffLaunched) {
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
  }, [initialized, handoffLaunched, fetchConnection]);

  useEffect(() => {
    if (
      !handoffLaunched ||
      connection.dbConnected ||
      connection.notionConnected
    ) {
      setShowSafariFallback(false);
      return;
    }

    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        setShowSafariFallback(true);
      }
    }, SAFARI_FALLBACK_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    handoffLaunched,
    connection.dbConnected,
    connection.notionConnected,
  ]);

  const uiStatus: NotionConnectUiStatus = useMemo(() => {
    if (!initialized) {
      return "starting";
    }

    if (!handoffId || fetchError) {
      return "failed";
    }

    if (!handoffLaunched) {
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
    handoffLaunched,
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
    if (!authUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(authUrl);
      setUrlCopied(true);
      window.setTimeout(() => setUrlCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy auth URL:", error);
    }
  };

  const fallbackActions = showSafariFallback ? (
    <SafariFallbackActions
      safariAuthUrl={safariAuthUrl}
      authUrl={authUrl}
      urlCopied={urlCopied}
      onCopyAuthUrl={() => {
        void handleCopyAuthUrl();
      }}
    />
  ) : null;

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
        {retryError && (
          <p className="text-xs text-red-700">{retryError}</p>
        )}
        {isRetrying && (
          <p className="text-xs text-stone-500">다시 연결을 준비하고 있습니다...</p>
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
        {retryError && (
          <p className="text-xs text-red-700">{retryError}</p>
        )}
        {isRetrying && (
          <p className="text-xs text-stone-500">다시 연결을 준비하고 있습니다...</p>
        )}
      </StatusLayout>
    );
  }

  if (uiStatus === "starting") {
    return (
      <StatusLayout
        title="Safari에서 Notion을 연결하고 있어요"
        description="Notion 계정 승인 후 사용할 데이터베이스까지 선택해 주세요."
        hint="모든 과정이 완료되면 이 앱으로 돌아오세요."
      >
        {isIOS() && safariAuthUrl && (
          <a
            href={safariAuthUrl}
            className="inline-block rounded-md bg-stone-800 px-4 py-2 text-sm text-white"
          >
            Safari에서 열기
          </a>
        )}
      </StatusLayout>
    );
  }

  if (uiStatus === "handoff_started") {
    return (
      <StatusLayout
        title={
          connection.loading
            ? "연결 상태 확인 중"
            : "Safari에서 연결을 진행해 주세요"
        }
        description={
          connection.loading
            ? "Notion 연결 진행 상황을 확인하고 있습니다."
            : "Safari에서 Notion 계정을 승인한 뒤 데이터베이스까지 선택해야 합니다."
        }
        hint={
          connection.loading
            ? undefined
            : "Safari가 열려 있다면 Safari로 돌아가 연결을 계속해 주세요."
        }
      >
        {fallbackActions}
      </StatusLayout>
    );
  }

  if (uiStatus === "notion_authorized") {
    return (
      <StatusLayout
        step="1단계 완료"
        title="데이터베이스 선택이 남아 있어요"
        description="Notion 계정은 연결되었습니다. Safari에서 사용할 데이터베이스를 선택해 주세요."
        hint="데이터베이스 연결 완료 화면이 나타난 뒤 이 앱으로 돌아오세요."
      >
        {isIOS() && safariHomeUrl && (
          <a
            href={safariHomeUrl}
            className="inline-block rounded-md bg-stone-800 px-4 py-2 text-sm text-white"
          >
            Safari에서 DB 선택 계속하기
          </a>
        )}
      </StatusLayout>
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
