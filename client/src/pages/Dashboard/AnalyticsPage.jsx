/**
 * AnalyticsPage.jsx  (Phase 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard analytics page. Shows:
 *  - Overview stat cards
 *  - Notes created over time (bar chart)
 *  - Top tags (horizontal bar)
 *  - Top viewed public notes
 *  - Recent activity list
 */

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import notesService from '../../services/notesService';
import styles       from './AnalyticsPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statValue}>{value}</span>
      <div className={styles.statInfo}>
        <span className={styles.statLabel}>{label}</span>
        {sub && <span className={styles.statSub}>{sub}</span>}
      </div>
    </div>
  );
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}

function formatChartMonth(monthStr) {
  if (!monthStr) return '';
  const parts = monthStr.split('-');
  if (parts.length !== 2) return monthStr;
  const [year, month] = parts;
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

// Recharts custom tooltip
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <span className={styles.tooltipLabel}>{label}</span>
      <span className={styles.tooltipValue}>{payload[0].value}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    async function load() {
      try {
        const result = await notesService.getAnalyticsDashboard();
        setData(result);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>Analytics</h1>
        <div className={styles.loadingGrid}>
          {[...Array(4)].map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>Analytics</h1>
        <p className={styles.error}>{error}</p>
      </div>
    );
  }

  const { overview, topTags, topViewed, recentActivity, createdOverTime } = data;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Analytics</h1>
        <p className={styles.pageSub}>Insights about your notes</p>
      </div>

      {/* ── Overview cards ─────────────────────────────────────────────── */}
      <div className={styles.statGrid}>
        <StatCard label="Total notes"  value={overview.totalNotes}  />
        <StatCard label="Public notes" value={overview.publicNotes} />
        <StatCard label="Pinned"       value={overview.pinnedNotes} />
        <StatCard label="Total views"  value={overview.totalViews}  sub="across public notes" />
      </div>

      {/* ── Two-column grid ────────────────────────────────────────────── */}
      <div className={styles.chartsGrid}>

        {/* Notes created over time */}
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Notes created — last 6 months</h2>
          {createdOverTime.length === 0 ? (
            <p className={styles.empty}>No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={createdOverTime} barSize={20}>
                <XAxis
                  dataKey="month"
                  tick={{ fontFamily: 'DM Mono', fontSize: 10, fill: 'var(--muted)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatChartMonth}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontFamily: 'DM Mono', fontSize: 10, fill: 'var(--muted)' }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--cream)' }} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {createdOverTime.map((_, i) => (
                    <Cell key={i} fill="var(--ink)" opacity={0.7 + i * 0.04} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top tags */}
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Top tags</h2>
          {topTags.length === 0 ? (
            <p className={styles.empty}>No tags yet</p>
          ) : (
            <div className={styles.tagBars}>
              {topTags.slice(0, 8).map(({ tag, count }) => {
                const pct = Math.round((count / topTags[0].count) * 100);
                return (
                  <div key={tag} className={styles.tagBarRow}>
                    <span className={styles.tagBarLabel}>{tag}</span>
                    <div className={styles.tagBarTrack}>
                      <div className={styles.tagBarFill} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={styles.tagBarCount}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top viewed public notes */}
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Most viewed public notes</h2>
          {topViewed.length === 0 ? (
            <p className={styles.empty}>No public notes yet</p>
          ) : (
            <ol className={styles.rankList}>
              {topViewed.map((note, i) => (
                <li key={note._id} className={styles.rankItem}>
                  <span className={styles.rankNum}>{i + 1}</span>
                  <span className={styles.rankTitle}>{note.title}</span>
                  <span className={styles.rankViews}>
                    {note.analytics?.viewCount ?? 0} views
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Recent activity */}
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Recently updated</h2>
          {recentActivity.length === 0 ? (
            <p className={styles.empty}>No notes yet</p>
          ) : (
            <ul className={styles.activityList}>
              {recentActivity.map((note) => (
                <li key={note._id} className={styles.activityItem}>
                  <div className={styles.activityInfo}>
                    <span className={styles.activityTitle}>{note.title}</span>
                    <span className={styles.activityDate}>{formatDate(note.updatedAt)}</span>
                  </div>
                  <span className={`${styles.visBadge} ${note.isPublic ? styles.public : styles.private}`}>
                    {note.isPublic ? 'Public' : 'Private'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
