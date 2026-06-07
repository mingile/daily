import { randomUUID } from "crypto"

/**
 * Widget 토큰 생성 함수
 *
 * 토큰 생성 정책:
 * - 형식: daily_widget_<uuid>
 * - 예시: daily_widget_550e8400-e29b-41d4-a716-446655440000
 * - UUID v4 기반으로 암호학적으로 안전한 랜덤 값 사용
 * - Math.random() 대신 crypto.randomUUID() 사용하여 보안성 확보
 *
 * @returns {string} 생성된 widget 토큰
 *
 * @example
 * const token = generateWidgetToken()
 * // => "daily_widget_550e8400-e29b-41d4-a716-446655440000"
 */
export function generateWidgetToken(): string {
  return `daily_widget_${randomUUID()}`
}
