import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "서비스 이용약관",
  description: "daily 서비스 이용약관",
};

export default function TermsOfServicePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight hover:underline underline-offset-4"
          >
            daily
          </Link>
          <Button asChild size="sm" variant="outline">
            <Link href="/">홈으로</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
          <h1 className="text-3xl font-semibold tracking-tight">
            daily 이용약관
          </h1>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            최종 수정일: 2026년 8월 16일
          </p>

          <div className="mt-10 space-y-10 text-sm leading-relaxed sm:text-base">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">제1조 (목적)</h2>
              <p className="text-muted-foreground">
                본 약관은 daily(이하 &quot;서비스&quot;)의 이용과 관련하여
                서비스 제공자와 이용자가 준수해야 할 기본적인 사항을 정하는 것을
                목적으로 합니다.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">제2조 (서비스의 목적)</h2>
              <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
                <li>
                  daily는 사용자의 식사·약 복용·운동 등 일일 건강 기록 작성 및
                  관리를 지원하는 기록 도구입니다.
                </li>
                <li>
                  서비스는 일일 기록 관리, Notion 연동, 복약 알림 등의 기능을
                  제공합니다.
                </li>
                <li>
                  서비스에서 제공하는 기능은 개인 기록 관리 목적이며, 의료
                  서비스, 약물 처방, 영양 상담 또는 전문적인 건강 관리를
                  제공하지 않습니다.
                </li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                제3조 (데이터 저장 및 관리)
              </h2>
              <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
                <li>
                  daily는 사용자의 일일 기록을 사용자의 기기에 저장하는
                  local-first 방식으로 동작합니다.
                </li>
                <li>
                  사용자의 일일 기록 데이터는 기본적으로 사용자의 기기 내 저장
                  공간에 보관됩니다.
                </li>
                <li>
                  복약 알림 기능을 사용하는 경우, 약 정보·복약 기록·푸시 구독
                  정보는 서버에 저장됩니다.
                </li>
                <li>
                  이용자는 자신의 기기 관리, 저장 데이터 관리 및 데이터 백업에
                  대한 책임을 가집니다.
                </li>
                <li>
                  기기 변경, 브라우저 데이터 삭제, 저장 공간 초기화 등 이용자의
                  행위로 인해 데이터가 삭제될 수 있으며, 서비스 제공자는 이러한
                  데이터 손실을 복구할 책임을 부담하지 않습니다.
                </li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                제4조 (외부 서비스 연동)
              </h2>
              <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
                <li>
                  daily는 이용자의 선택에 따라 Notion 등 외부 서비스를 통한
                  데이터 백업 및 연동 기능을 제공할 수 있습니다.
                </li>
                <li>
                  복약 알림 기능은 외부 서비스를 통해 예약된 알림을 발송합니다.
                </li>
                <li>
                  외부 서비스 연동을 이용하는 경우, 이용자는 해당 서비스의
                  이용약관 및 개인정보 처리방침을 함께 확인해야 합니다.
                </li>
                <li>
                  외부 서비스의 장애, 정책 변경, 서비스 종료 등으로 인해
                  발생하는 문제에 대해 daily는 책임을 부담하지 않습니다.
                </li>
                <li>
                  이용자는 외부 서비스에 저장되는 데이터의 관리 책임이 해당
                  서비스 제공자에게 있음을 이해합니다.
                </li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">제5조 (복약 알림)</h2>
              <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
                <li>
                  복약 알림 기능은 이용자가 직접 등록한 약에 대해 지정된 시간에
                  푸시 알림을 발송하는 보조 기능입니다.
                </li>
                <li>
                  복약 알림은 이용자의 기록 편의를 위한 것이며, 실제 복용 여부를
                  보장하거나 의료적 판단을 대체하지 않습니다.
                </li>
                <li>
                  이용자는 브라우저 알림 권한, 네트워크 환경, 기기 상태 등에
                  따라 알림이 수신되지 않을 수 있음을 이해합니다.
                </li>
                <li>
                  이용자는 약 복용 여부를 스스로 확인하고, 의료적 판단이 필요한
                  경우 반드시 의료 전문가와 상담해야 합니다.
                </li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                제6조 (서비스 이용 책임)
              </h2>
              <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
                <li>
                  이용자는 자신의 일일 기록 및 서비스 이용 환경을 관리할 책임이
                  있습니다.
                </li>
                <li>
                  이용자는 본인의 건강 상태를 고려하여 서비스를 이용해야 하며,
                  기록된 약 정보의 정확성에 대한 책임은 이용자에게 있습니다.
                </li>
                <li>
                  daily는 사용자가 기록한 식사·약 복용 정보의 정확성이나
                  건강상의 결과를 보장하지 않습니다.
                </li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                제7조 (서비스 변경 및 종료)
              </h2>
              <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
                <li>
                  서비스 제공자는 서비스 개선, 운영상 필요 또는 기술적 사유에
                  따라 서비스의 기능을 변경하거나 제공을 종료할 수 있습니다.
                </li>
                <li>
                  중요한 변경 사항이 있는 경우 가능한 범위에서 서비스 내 안내를
                  제공합니다.
                </li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">제8조 (책임 제한)</h2>
              <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
                <li>
                  daily는 일일 건강 기록 관리 목적의 도구이며, 사용자의 건강
                  상태 개선, 약물 복용 적절성 또는 특정 결과를 보장하지
                  않습니다.
                </li>
                <li>
                  이용자는 자신의 판단과 책임하에 서비스를 사용해야 합니다.
                </li>
                <li>
                  다음과 같은 사유로 발생한 문제에 대해 서비스 제공자는 책임을
                  제한할 수 있습니다.
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>이용자의 기기 오류 또는 데이터 삭제</li>
                    <li>네트워크 환경 문제</li>
                    <li>푸시 알림 미수신 또는 지연</li>
                    <li>
                      외부 서비스(Notion, Upstash QStash 등)의 장애 또는 변경
                    </li>
                    <li>이용자의 부적절한 사용</li>
                  </ul>
                </li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">제9조 (개인정보 보호)</h2>
              <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
                <li>서비스는 이용자의 개인정보 보호를 중요하게 생각합니다.</li>
                <li>
                  개인정보 처리에 관한 자세한 내용은 별도의{" "}
                  <Link
                    href="/privacy"
                    className="text-foreground underline underline-offset-4 hover:text-primary"
                  >
                    개인정보 처리방침
                  </Link>
                  에서 확인할 수 있습니다.
                </li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">제10조 (약관 변경)</h2>
              <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
                <li>
                  서비스 제공자는 서비스 운영 및 관련 정책 변경에 따라 본 약관을
                  수정할 수 있습니다.
                </li>
                <li>변경된 약관은 서비스 내 안내를 통해 적용됩니다.</li>
              </ol>
            </section>
          </div>
        </article>
      </main>
    </div>
  );
}
