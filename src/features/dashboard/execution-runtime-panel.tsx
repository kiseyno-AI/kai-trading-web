"use client";

import { useEffect, useMemo, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import type { DashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import type {
  ExecutionRuntimeDailyBoardResponseDto,
  ExecutionRuntimeMonitoredSymbolsResponseDto,
  ExecutionRuntimeStatusResponseDto,
} from "@/types/trading-api";

import {
  buildExecutionRuntimeDailyBoardModel,
  buildExecutionRuntimeMonitoredSymbolsModel,
  buildExecutionRuntimeSummaryModel,
} from "./execution-runtime-display";
import styles from "./execution-runtime-panel.module.css";

type ExecutionRuntimePanelProps = {
  board: ExecutionRuntimeDailyBoardResponseDto | null;
  boardError: string | null;
  copy: DashboardLiveCopy;
  marketDate: string | null;
  monitoredSymbols: ExecutionRuntimeMonitoredSymbolsResponseDto | null;
  monitoredSymbolsError: string | null;
  numberLocale: string;
  status: ExecutionRuntimeStatusResponseDto | null;
  statusError: string | null;
};

function getInitialNowMs(status: ExecutionRuntimeStatusResponseDto | null) {
  const heartbeatMs = status?.last_heartbeat_at ? Date.parse(status.last_heartbeat_at) : NaN;
  return Number.isFinite(heartbeatMs) ? heartbeatMs : 0;
}

export function ExecutionRuntimePanel({
  board,
  boardError,
  copy,
  marketDate,
  monitoredSymbols,
  monitoredSymbolsError,
  numberLocale,
  status,
  statusError,
}: ExecutionRuntimePanelProps) {
  const runtimeCopy = copy.executionRuntime;
  const [nowMs, setNowMs] = useState(() => getInitialNowMs(status));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNowMs(Date.now());
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [status?.last_heartbeat_at]);

  const summaryModel = useMemo(
    () =>
      buildExecutionRuntimeSummaryModel({
        copy: runtimeCopy,
        error: statusError,
        nowMs,
        numberLocale,
        status,
      }),
    [nowMs, numberLocale, runtimeCopy, status, statusError],
  );
  const monitoredSymbolsModel = useMemo(
    () =>
      buildExecutionRuntimeMonitoredSymbolsModel({
        copy: runtimeCopy,
        error: monitoredSymbolsError,
        monitoredSymbols,
        numberLocale,
      }),
    [monitoredSymbols, monitoredSymbolsError, numberLocale, runtimeCopy],
  );
  const boardModel = useMemo(
    () =>
      buildExecutionRuntimeDailyBoardModel({
        board,
        copy: runtimeCopy,
        error: boardError,
        numberLocale,
      }),
    [board, boardError, numberLocale, runtimeCopy],
  );

  return (
    <section className={styles.runtimeSection} aria-labelledby="execution-runtime-title">
      <ComponentTag
        label="dashboard.execution-runtime"
        api="/api/trading/execution/runtime/status + /api/trading/execution/runtime/monitored-symbols + /api/trading/execution/runtime/daily-board"
      />

      <div className={styles.runtimeGrid}>
        <article className={styles.panel} data-runtime-status={summaryModel.statusKey}>
          <div className={styles.sectionHeaderRow}>
            <div>
              <p className={styles.sectionEyebrow}>{runtimeCopy.eyebrow}</p>
              <h2 id="execution-runtime-title" className={styles.sectionTitle}>
                {runtimeCopy.title}
              </h2>
            </div>
            <span className={`pill ${summaryModel.statusTone}`}>{summaryModel.statusLabel}</span>
          </div>

          <dl className={styles.runtimeStateList}>
            <div>
              <dt>{runtimeCopy.mode}</dt>
              <dd>{summaryModel.modeLabel}</dd>
            </div>
            <div>
              <dt>{runtimeCopy.connectionLabel}</dt>
              <dd className={styles[`${summaryModel.connectionTone}Text`]}>{summaryModel.connectionLabel}</dd>
            </div>
            <div>
              <dt>{runtimeCopy.automationLabel}</dt>
              <dd className={styles[`${summaryModel.automationTone}Text`]}>{summaryModel.automationLabel}</dd>
            </div>
            <div>
              <dt>{runtimeCopy.monitoringLabel}</dt>
              <dd className={styles[`${summaryModel.monitoringTone}Text`]}>{summaryModel.monitoringLabel}</dd>
            </div>
          </dl>

          <div className={styles.metricGrid}>
            {summaryModel.metrics.map((metric) => (
              <div key={metric.key} className={styles.metric}>
                <span>{metric.label}</span>
                <strong className={styles[`${metric.tone}Text`]}>{metric.value}</strong>
              </div>
            ))}
          </div>

          {summaryModel.contextLabel ? <p className={styles.cardContext}>{summaryModel.contextLabel}</p> : null}

          {summaryModel.issueLabels.length > 0 ? (
            <div className={styles.issueList}>
              <strong>{runtimeCopy.issues}</strong>
              <ul>
                {summaryModel.issueLabels.slice(0, 3).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>

        <article className={styles.panel}>
          <div className={styles.sectionHeaderRow}>
            <div>
              <p className={styles.sectionEyebrow}>{runtimeCopy.monitoringLabel}</p>
              <h2 className={styles.sectionTitle}>{runtimeCopy.monitoredTitle}</h2>
            </div>
            <span className="pill neutral">{monitoredSymbolsModel.countLabel}</span>
          </div>

          {monitoredSymbolsModel.stateSummaryLabel ? (
            <p className={styles.cardContext}>{monitoredSymbolsModel.stateSummaryLabel}</p>
          ) : null}
          {monitoredSymbolsModel.errorLabel ? <p className={styles.cardContext}>{monitoredSymbolsModel.errorLabel}</p> : null}

          {monitoredSymbolsModel.items.length > 0 ? (
            <div className={styles.symbolList} role="list" aria-label={runtimeCopy.monitoredTitle}>
              {monitoredSymbolsModel.items.map((item) => (
                <div key={item.key} className={styles.symbolRow} role="listitem" data-monitoring-state={item.stateKey}>
                  <div className={styles.symbolIdentity}>
                    <strong>{item.nameLabel}</strong>
                    <span>
                      {item.symbol}
                      {item.marketLabel ? ` · ${item.marketLabel}` : ""}
                    </span>
                  </div>
                  <div className={styles.symbolMeta}>
                    <span className={`pill ${item.stateTone}`}>{item.stateLabel}</span>
                    {item.intentLabel ? <span>{item.intentLabel}</span> : null}
                    {item.positionLabel ? <span>{item.positionLabel}</span> : null}
                    <span>{item.lastEventLabel}</span>
                  </div>
                  {item.statusSummaryLabel ? <p className={styles.cardContext}>{item.statusSummaryLabel}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>{runtimeCopy.noMonitoredSymbols}</div>
          )}
        </article>
      </div>

      <article className={`${styles.panel} ${styles.boardPanel}`}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <p className={styles.sectionEyebrow}>{marketDate ?? boardModel.boardDateLabel}</p>
            <h2 className={styles.sectionTitle}>{runtimeCopy.boardTitle}</h2>
          </div>
          <span className="pill neutral">
            {runtimeCopy.totalRows} {boardModel.totalLabel}
          </span>
        </div>

        <div className={styles.boardSummary} aria-label={runtimeCopy.boardTitle}>
          {boardModel.summaryItems.map((item) => (
            <div key={item.key} className={styles.boardSummaryItem} data-board-status={item.key}>
              <span>{item.label}</span>
              <strong className={styles[`${item.tone}Text`]}>{item.value}</strong>
            </div>
          ))}
        </div>

        {boardModel.errorLabel ? <p className={styles.cardContext}>{boardModel.errorLabel}</p> : null}

        {boardModel.rows.length > 0 ? (
          <div className={styles.boardRows} role="list" aria-label={runtimeCopy.boardTitle}>
            <div className={`${styles.boardRow} ${styles.boardHeader}`} aria-hidden="true">
              <span>{runtimeCopy.board.symbol}</span>
              <span>{runtimeCopy.board.status}</span>
              <span>{runtimeCopy.board.fill}</span>
              <span>{runtimeCopy.board.price}</span>
              <span>{runtimeCopy.board.updated}</span>
            </div>
            {boardModel.rows.map((row) => (
              <div key={row.key} className={styles.boardRow} role="listitem" data-board-status={row.statusKey}>
                <div className={styles.boardSymbolCell}>
                  <strong>{row.nameLabel}</strong>
                  <span>
                    {row.symbol}
                    {row.marketLabel ? ` · ${row.marketLabel}` : ""}
                  </span>
                  <small>{row.intentLabel}</small>
                </div>
                <div>
                  <span className={`pill ${row.statusTone}`}>{row.statusLabel}</span>
                  {row.failureReason ? <small>{row.failureReason}</small> : null}
                </div>
                <span>{row.fillLabel}</span>
                <span>{row.priceLabel}</span>
                <span>{row.lastUpdatedLabel}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>{runtimeCopy.noBoardRows}</div>
        )}
      </article>
    </section>
  );
}
