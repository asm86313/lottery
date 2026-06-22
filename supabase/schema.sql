-- Supabase SQL Editor에서 실행하세요
-- lottery_draws 테이블 생성

CREATE TABLE IF NOT EXISTS lottery_draws (
  drw_no       INTEGER      PRIMARY KEY,
  drwt_no1     SMALLINT     NOT NULL,
  drwt_no2     SMALLINT     NOT NULL,
  drwt_no3     SMALLINT     NOT NULL,
  drwt_no4     SMALLINT     NOT NULL,
  drwt_no5     SMALLINT     NOT NULL,
  drwt_no6     SMALLINT     NOT NULL,
  bnus_no      SMALLINT     NOT NULL,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- 서버(서비스 롤)만 insert/update 가능하도록 RLS 설정
ALTER TABLE lottery_draws ENABLE ROW LEVEL SECURITY;

-- 누구나 조회 가능 (분석 결과 표시용)
CREATE POLICY "public read"
  ON lottery_draws FOR SELECT
  USING (true);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_lottery_draws_drw_no ON lottery_draws (drw_no);

-- 분석 결과 저장 테이블
CREATE TABLE IF NOT EXISTS analysis_results (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  analyzed_draw_no INTEGER      NOT NULL,
  recommended_sets JSONB        NOT NULL,
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read analysis results"
  ON analysis_results FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_analysis_results_draw ON analysis_results (analyzed_draw_no);
