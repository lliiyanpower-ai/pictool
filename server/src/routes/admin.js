"use strict";

const express = require("express");
const path = require("path");
const { getDateRange } = require("../utils/date-range");
const { getDashboardMetrics, getSessionDetail, getSessions } = require("../utils/metrics");
const { listInsights } = require("../services/insights-service");

const router = express.Router();

router.use("/assets/react", express.static(path.resolve(__dirname, "../../node_modules/react/umd")));
router.use("/assets/react-dom", express.static(path.resolve(__dirname, "../../node_modules/react-dom/umd")));
router.use("/assets/dayjs", express.static(path.resolve(__dirname, "../../node_modules/dayjs")));
router.use("/assets/antd", express.static(path.resolve(__dirname, "../../node_modules/antd/dist")));

function escapeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function renderDashboard(range, data, insights) {
  const pageState = {
    range,
    data,
    insights
  };

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>pictool 指标看板</title>
    <link rel="stylesheet" href="/admin/assets/antd/reset.css" />
    <style>
      body {
        margin: 0;
        background: #f5f7fb;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #root { min-height: 100vh; }
      .dashboard-shell { width: min(1280px, calc(100vw - 32px)); margin: 0 auto; padding: 24px 0 40px; }
      .dashboard-header { margin-bottom: 18px; }
      .dashboard-title { margin-bottom: 4px !important; letter-spacing: 0; }
      .code-tag { color: #667085; font-size: 12px; }
      .date-input { width: 150px; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>
      window.__PICTOOL_METRICS__ = ${escapeJsonForHtml(pageState)};
    </script>
    <script src="/admin/assets/react/react.production.min.js"></script>
    <script src="/admin/assets/react-dom/react-dom.production.min.js"></script>
    <script src="/admin/assets/dayjs/dayjs.min.js"></script>
    <script src="/admin/assets/antd/antd.min.js"></script>
    <script>
      (function () {
        if (!window.React || !window.ReactDOM || !window.dayjs || !window.antd) {
          document.getElementById("root").innerHTML = '<div class="dashboard-shell"><div style="padding:16px;background:#fff;border-radius:8px">后台资源加载失败，请刷新页面或检查 /admin/assets 资源。</div></div>';
          return;
        }
        const state = window.__PICTOOL_METRICS__;
        const h = React.createElement;
        const {
          Button,
          Card,
          Col,
          ConfigProvider,
          Alert,
          Collapse,
          Empty,
          Form,
          Input,
          Layout,
          Row,
          Space,
          Statistic,
          Table,
          Tag,
          Typography,
          theme
        } = antd;
        const { Content } = Layout;
        const { Text, Title } = Typography;
        const useState = React.useState;

        function codeTag(value) {
          return value ? h("div", { className: "code-tag" }, value) : null;
        }

        function primaryWithCode(label, code) {
          return h("div", null, h("strong", null, label || code || "未知"), codeTag(code));
        }

        function queryByDate(values) {
          const params = new URLSearchParams();
          if (values.from) params.set("from", values.from);
          if (values.to) params.set("to", values.to);
          window.location.href = "/admin/metrics?" + params.toString();
        }

        function goToRange(from, to) {
          window.location.href = "/admin/metrics?from=" + from + "&to=" + to;
        }

        function applyQuickRange(type) {
          const today = dayjs();
          if (type === "today") {
            goToRange(today.format("YYYY-MM-DD"), today.format("YYYY-MM-DD"));
            return;
          }
          if (type === "yesterday") {
            const yesterday = today.subtract(1, "day");
            goToRange(yesterday.format("YYYY-MM-DD"), yesterday.format("YYYY-MM-DD"));
            return;
          }
          if (type === "last30") {
            goToRange(today.subtract(29, "day").format("YYYY-MM-DD"), today.format("YYYY-MM-DD"));
            return;
          }
          goToRange(today.subtract(6, "day").format("YYYY-MM-DD"), today.format("YYYY-MM-DD"));
        }

        function refreshPage() {
          window.location.reload();
        }

        function metricCard(title, value, suffix) {
          return h(Col, { xs: 24, sm: 12, md: 8, lg: 4 },
            h(Card, { bordered: false },
              h(Statistic, { title, value, suffix })
            )
          );
        }

        function formatRate(value) {
          return Math.round(Number(value || 0) * 100) + "%";
        }

        function cleanMetricItems(items) {
          return (items || []).filter(function (item) {
            return item && item.label && item.value !== undefined && item.value !== null && item.value !== "";
          });
        }

        function renderMetricChips(items) {
          const metrics = cleanMetricItems(items);
          if (!metrics.length) return null;
          return h(Space, { size: 8, wrap: true },
            metrics.map(function (item) {
              return h(Tag, { key: item.label + ":" + item.value }, item.label + "：" + item.value);
            })
          );
        }

        function renderDebugDetails(insight) {
          const metrics = cleanMetricItems(insight.debug_metrics);
          if (!metrics.length) return null;
          return h(Collapse, {
            ghost: true,
            size: "small",
            style: { marginTop: 8 },
            items: [{
              key: "debug",
              label: "查看指标详情",
              children: h(Space, { size: 8, wrap: true },
                metrics.map(function (item) {
                  return h(Tag, { key: item.label + ":" + item.value }, item.label + "：" + item.value);
                })
              )
            }]
          });
        }

        const severityMeta = {
          info: { color: "geekblue", label: "普通信息" },
          notice: { color: "blue", label: "值得关注" },
          warning: { color: "orange", label: "需要排查" },
          critical: { color: "red", label: "严重异常" }
        };

        const tableDefaults = {
          size: "middle",
          pagination: false,
          rowKey: function (row, index) {
            return [row.tool, row.event_name, row.preset, row.reason, index].filter(Boolean).join("-");
          },
          locale: { emptyText: "暂无数据" },
          scroll: { x: true }
        };

        const toolColumns = [
          {
            title: "工具",
            dataIndex: "tool_name",
            render: function (_, row) {
              return primaryWithCode(row.tool_name, row.tool);
            }
          },
          { title: "打开", dataIndex: "opens", align: "right" },
          { title: "上传", dataIndex: "uploads", align: "right" },
          { title: "核心操作", dataIndex: "core_actions", align: "right" },
          { title: "下载", dataIndex: "downloads", align: "right" },
          {
            title: "上传下载转化率",
            dataIndex: "upload_to_download_rate",
            align: "right",
            render: formatRate
          },
          { title: "失败数", dataIndex: "failure_count", align: "right" },
          {
            title: "失败率",
            dataIndex: "failure_rate",
            align: "right",
            render: formatRate
          }
        ];

        const eventColumns = [
          {
            title: "事件",
            dataIndex: "event_name_zh",
            render: function (_, row) {
              return primaryWithCode(row.event_name_zh, row.event_name);
            }
          },
          { title: "次数", dataIndex: "count", align: "right" }
        ];

        const presetColumns = [
          {
            title: "工具",
            dataIndex: "tool_name",
            render: function (_, row) {
              return primaryWithCode(row.tool_name, row.tool);
            }
          },
          {
            title: "预设",
            dataIndex: "preset_name",
            render: function (_, row) {
              return primaryWithCode(row.preset_name, row.preset);
            }
          },
          { title: "次数", dataIndex: "count", align: "right" }
        ];

        const failureColumns = [
          {
            title: "事件",
            dataIndex: "event_name_zh",
            render: function (_, row) {
              return primaryWithCode(row.event_name_zh, row.event_name);
            }
          },
          {
            title: "原因",
            dataIndex: "reason",
            render: function (value) {
              return h(Tag, { color: value === "unknown" ? "default" : "red" }, value || "unknown");
            }
          },
          { title: "次数", dataIndex: "count", align: "right" }
        ];

        function Dashboard() {
          const [insights, setInsights] = useState(state.insights || []);
          const [isGenerating, setIsGenerating] = useState(false);
          const [notice, setNotice] = useState("");
          const summary = state.data.summary;
          const hasSmallSamples = summary.image_uploaded < 10 || state.data.tools.some(function (tool) {
            return tool.uploads > 0 && tool.uploads < 10;
          });

          async function generateInsights() {
            setIsGenerating(true);
            setNotice("正在生成数据摘要...");
            try {
              const response = await fetch("/api/metrics/insights/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ from: state.range.fromLabel, to: state.range.toLabel })
              });
              if (!response.ok) throw new Error("generate_failed");
              const result = await response.json();
              setInsights(result.insights || []);
              setNotice("数据摘要已更新。");
            } catch (error) {
              setNotice("数据摘要生成失败，请稍后重试。");
            } finally {
              setIsGenerating(false);
            }
          }

          function renderInsightCards() {
            if (!insights.length) {
              return h(Empty, {
                image: Empty.PRESENTED_IMAGE_SIMPLE,
                description: "当前时间范围内数据不足，暂未生成洞察。"
              });
            }

            return h(Row, { gutter: [12, 12] },
              insights.map(function (insight) {
                const meta = severityMeta[insight.severity] || severityMeta.info;
                return h(Col, { xs: 24, md: 12, xl: 8, key: insight.id || insight.title },
                  h(Card, {
                    bordered: true,
                    title: h(Space, { size: 8 },
                      h(Tag, { color: meta.color }, meta.label),
                      h("span", null, insight.title)
                    )
                  },
                    h("p", { style: { marginTop: 0, lineHeight: 1.7 } }, insight.summary),
                    renderMetricChips(insight.display_metrics),
                    renderDebugDetails(insight),
                    insight.created_at ? h("div", { className: "code-tag", style: { marginTop: 10 } }, "生成时间：" + dayjs(insight.created_at).format("YYYY-MM-DD HH:mm:ss")) : null
                  )
                );
              })
            );
          }

          return h(ConfigProvider, {
            theme: {
              algorithm: theme.defaultAlgorithm,
              token: {
                borderRadius: 8,
                colorPrimary: "#315cfd",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              }
            }
          },
            h(Layout, { style: { minHeight: "100vh", background: "#f5f7fb" } },
              h(Content, null,
                h("div", { className: "dashboard-shell" },
                  h("div", { className: "dashboard-header" },
                    h(Title, { level: 2, className: "dashboard-title" }, "pictool 指标看板"),
                    h(Space, { size: 12, wrap: true },
                      h(Text, { type: "secondary" }, state.range.fromLabel + " 至 " + state.range.toLabel),
                      h(Button, { size: "small", href: "/admin/sessions" }, "会话诊断")
                    )
                  ),
                  h(Card, { bordered: false, style: { marginBottom: 16 } },
                    h(Space, { direction: "vertical", size: 12, style: { width: "100%" } },
                      h(Space, { size: 8, wrap: true },
                        h(Button, { onClick: function () { applyQuickRange("today"); } }, "今日"),
                        h(Button, { onClick: function () { applyQuickRange("yesterday"); } }, "昨日"),
                        h(Button, { onClick: function () { applyQuickRange("last7"); } }, "最近 7 天"),
                        h(Button, { onClick: function () { applyQuickRange("last30"); } }, "最近 30 天")
                      ),
                      h(Form, {
                        layout: "inline",
                        initialValues: { from: state.range.fromLabel, to: state.range.toLabel },
                        onFinish: queryByDate
                      },
                        h(Form.Item, { label: "开始日期", name: "from" },
                          h(Input, { type: "date", className: "date-input" })
                        ),
                        h(Form.Item, { label: "结束日期", name: "to" },
                          h(Input, { type: "date", className: "date-input" })
                        ),
                        h(Form.Item, null,
                          h(Button, { type: "primary", htmlType: "submit" }, "查询")
                        ),
                        h(Form.Item, null,
                          h(Button, { onClick: refreshPage }, "刷新数据")
                        )
                      )
                    )
                  ),
                  h(Row, { gutter: [16, 16], style: { marginBottom: 16 } },
                    metricCard("页面访问", summary.page_views),
                    metricCard("工具打开", summary.tool_opened),
                    metricCard("图片上传", summary.image_uploaded),
                    metricCard("下载点击", summary.download_clicked),
                    metricCard("上传下载转化率", summary.upload_to_download_rate),
                    metricCard("失败事件", summary.failures)
                  ),
                  h(Card, {
                    title: "数据摘要",
                    bordered: false,
                    style: { marginBottom: 16 },
                    extra: h(Button, { type: "primary", loading: isGenerating, onClick: generateInsights }, "生成洞察")
                  },
                    h(Space, { direction: "vertical", size: 12, style: { width: "100%" } },
                      notice ? h(Alert, {
                        message: notice,
                        type: notice.includes("失败") ? "error" : (notice.includes("更新") ? "success" : "info"),
                        showIcon: true
                      }) : null,
                      hasSmallSamples ? h(Alert, {
                        message: "部分工具数据量较少，暂不生成转化判断。",
                        type: "info",
                        showIcon: true
                      }) : null,
                      renderInsightCards()
                    )
                  ),
                  h(Row, { gutter: [16, 16] },
                    h(Col, { xs: 24, xl: 12 },
                      h(Card, { title: "工具指标", bordered: false },
                        h(Table, { ...tableDefaults, columns: toolColumns, dataSource: state.data.tools })
                      )
                    ),
                    h(Col, { xs: 24, xl: 12 },
                      h(Card, { title: "事件排行", bordered: false },
                        h(Table, { ...tableDefaults, columns: eventColumns, dataSource: state.data.events })
                      )
                    ),
                    h(Col, { xs: 24, xl: 12 },
                      h(Card, { title: "预设排行", bordered: false },
                        h(Table, { ...tableDefaults, columns: presetColumns, dataSource: state.data.presets })
                      )
                    ),
                    h(Col, { xs: 24, xl: 12 },
                      h(Card, { title: "失败排行", bordered: false },
                        h(Table, { ...tableDefaults, columns: failureColumns, dataSource: state.data.failures })
                      )
                    )
                  )
                )
              )
            )
          );
        }

        ReactDOM.createRoot(document.getElementById("root")).render(h(Dashboard));
      })();
    </script>
  </body>
</html>`;
}

function renderSessionsPage(range, sessions, filter, outcome, tool) {
  const pageState = { range, sessions, filter: filter || "all", outcome: outcome || "all", tool: tool || "" };
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>匿名会话诊断</title>
    <link rel="stylesheet" href="/admin/assets/antd/reset.css" />
    <style>
      body { margin: 0; background: #f5f7fb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      #root { min-height: 100vh; }
      .diagnostics-shell { width: min(1400px, calc(100vw - 32px)); margin: 0 auto; padding: 24px 0 40px; }
      .code-tag { color: #667085; font-size: 12px; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .date-input { width: 150px; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>window.__PICTOOL_SESSIONS__ = ${escapeJsonForHtml(pageState)};</script>
    <script src="/admin/assets/react/react.production.min.js"></script>
    <script src="/admin/assets/react-dom/react-dom.production.min.js"></script>
    <script src="/admin/assets/dayjs/dayjs.min.js"></script>
    <script src="/admin/assets/antd/antd.min.js"></script>
    <script>
      (function () {
        if (!window.React || !window.ReactDOM || !window.dayjs || !window.antd) {
          document.getElementById("root").innerHTML = '<div class="diagnostics-shell"><div style="padding:16px;background:#fff;border-radius:8px">后台资源加载失败，请刷新页面或检查 /admin/assets 资源。</div></div>';
          return;
        }
        const state = window.__PICTOOL_SESSIONS__;
        const h = React.createElement;
        const { Alert, Button, Card, ConfigProvider, Empty, Form, Input, Layout, Select, Space, Table, Tag, Typography, theme } = antd;
        const { Content } = Layout;
        const { Text, Title } = Typography;
        const flagMeta = {
          has_error: ["red", "有失败事件"],
          uploaded_no_download: ["orange", "上传后未下载"],
          export_failed: ["volcano", "导出失败"],
          upload_failed: ["magenta", "上传失败"],
          download_failed: ["red", "下载失败"],
          tool_switch_no_download: ["gold", "多次切换未下载"],
          left_after_upload: ["blue", "上传后未完成"]
        };
        const outcomeMeta = {
          completed: ["green", "已完成下载"],
          failed: ["red", "遇到失败"],
          tool_switch_no_download: ["gold", "多次切换未下载"],
          editing_unfinished: ["orange", "编辑未完成"],
          uploaded_no_download: ["volcano", "上传后未下载"],
          browsed_only: ["default", "仅浏览"],
          unknown: ["default", "未归类"]
        };
        const actionGroupMeta = {
          upload: ["blue", "上传"],
          edit: ["geekblue", "编辑"],
          export: ["purple", "导出"],
          download: ["green", "下载"],
          error: ["red", "失败"],
          navigation: ["cyan", "导航"],
          system: ["default", "系统"],
          none: ["default", "无关键行为"],
          unknown: ["default", "未知"]
        };
        const filterOptions = [
          { value: "all", label: "全部会话" },
          { value: "problem", label: "异常会话" },
          { value: "has_error", label: "有失败事件" },
          { value: "uploaded_no_download", label: "上传后未下载" },
          { value: "upload_failed", label: "上传失败" },
          { value: "export_failed", label: "导出失败" },
          { value: "tool_switch_no_download", label: "工作台多次切换未下载" }
        ];
        const outcomeOptions = [
          { value: "all", label: "全部结果" },
          { value: "completed", label: "已完成下载" },
          { value: "failed", label: "遇到失败" },
          { value: "uploaded_no_download", label: "上传后未下载" },
          { value: "editing_unfinished", label: "编辑未完成" },
          { value: "tool_switch_no_download", label: "多次切换未下载" },
          { value: "browsed_only", label: "仅浏览" }
        ];

        function flagTag(flag) {
          const meta = flagMeta[flag] || ["default", flag];
          return h(Tag, { color: meta[0], key: flag }, meta[1]);
        }

        function outcomeTag(outcome) {
          const meta = outcomeMeta[outcome] || outcomeMeta.unknown;
          return h(Tag, { color: meta[0] }, meta[1]);
        }

        function actionGroupTag(group) {
          const meta = actionGroupMeta[group] || actionGroupMeta.unknown;
          return h(Tag, { color: meta[0] }, meta[1]);
        }

        function formatTime(value) {
          return value ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "-";
        }

        function query(values) {
          const params = new URLSearchParams();
          params.set("filter", values.filter || "all");
          params.set("outcome", values.outcome || "all");
          if (values.from) params.set("from", values.from);
          if (values.to) params.set("to", values.to);
          if (values.tool) params.set("tool", values.tool);
          window.location.href = "/admin/sessions?" + params.toString();
        }

        const columns = [
          {
            title: "会话 ID",
            dataIndex: "session_id",
            render: function (value) {
              return h("div", null, h("strong", null, value.slice(0, 18) + "..."), h("div", { className: "code-tag" }, value));
            }
          },
          { title: "首次访问", dataIndex: "first_seen", render: formatTime },
          { title: "最后行为时间", dataIndex: "last_action_at", render: formatTime },
          {
            title: "最后行为类型",
            dataIndex: "last_action_group",
            render: actionGroupTag
          },
          {
            title: "最后关键行为",
            dataIndex: "last_action_name_zh",
            render: function (_, row) {
              return h("div", null,
                h("span", null, row.last_action_name_zh || row.last_action_name || "仅浏览"),
                h("div", { className: "code-tag" }, row.last_action_name || "")
              );
            }
          },
          {
            title: "会话结果",
            dataIndex: "session_outcome",
            render: outcomeTag
          },
          { title: "上传", dataIndex: "upload_count", align: "right" },
          { title: "下载", dataIndex: "download_count", align: "right" },
          { title: "失败", dataIndex: "error_count", align: "right" },
          {
            title: "问题标签",
            dataIndex: "problem_flags",
            render: function (flags) {
              return flags && flags.length ? h(Space, { size: 4, wrap: true }, flags.map(flagTag)) : h(Tag, null, "正常完成");
            }
          },
          {
            title: "操作",
            render: function (_, row) {
              return h(Button, { size: "small", href: "/admin/sessions/" + encodeURIComponent(row.session_id) }, "查看详情");
            }
          }
        ];

        function SessionsApp() {
          const items = state.sessions.items || [];
          const isProblemEmpty = state.filter !== "all" && items.length === 0;
          return h(ConfigProvider, {
            theme: { algorithm: theme.defaultAlgorithm, token: { borderRadius: 8, colorPrimary: "#315cfd" } }
          },
            h(Layout, { style: { minHeight: "100vh", background: "#f5f7fb" } },
              h(Content, null,
                h("div", { className: "diagnostics-shell" },
                  h(Space, { direction: "vertical", size: 16, style: { width: "100%" } },
                    h("div", null,
                      h(Title, { level: 2, style: { marginBottom: 4 } }, "匿名会话诊断"),
                      h(Space, { size: 12, wrap: true },
                        h(Text, { type: "secondary" }, state.range.fromLabel + " 至 " + state.range.toLabel),
                        h(Button, { size: "small", href: "/admin/metrics" }, "指标看板")
                      ),
                      h("div", { style: { marginTop: 8 } },
                        h(Text, { type: "secondary" }, "最后行为时间排除了普通页面访问，更适合判断用户最后一次有效操作。")
                      )
                    ),
                    h(Card, { bordered: false },
                      h(Form, { layout: "inline", initialValues: { from: state.range.fromLabel, to: state.range.toLabel, filter: state.filter, outcome: state.outcome, tool: state.tool }, onFinish: query },
                        h(Form.Item, { label: "开始日期", name: "from" }, h(Input, { type: "date", className: "date-input" })),
                        h(Form.Item, { label: "结束日期", name: "to" }, h(Input, { type: "date", className: "date-input" })),
                        h(Form.Item, { label: "筛选", name: "filter" }, h(Select, { style: { width: 180 }, options: filterOptions })),
                        h(Form.Item, { label: "会话结果", name: "outcome" }, h(Select, { style: { width: 170 }, options: outcomeOptions })),
                        h(Form.Item, { label: "工具", name: "tool" }, h(Select, { allowClear: true, style: { width: 150 }, options: [
                          { value: "compress", label: "图片压缩" },
                          { value: "crop", label: "图片裁剪" },
                          { value: "filter", label: "图片滤镜" },
                          { value: "title", label: "标题排版" },
                          { value: "workspace", label: "工作台" }
                        ] })),
                        h(Form.Item, null, h(Button, { type: "primary", htmlType: "submit" }, "查询"))
                      )
                    ),
                    isProblemEmpty ? h(Alert, { type: "info", showIcon: true, message: "当前时间范围内暂无异常会话。" }) : null,
                    h(Card, { title: "会话列表", bordered: false },
                      items.length ? h(Table, {
                        rowKey: "session_id",
                        size: "middle",
                        columns: columns,
                        dataSource: items,
                        pagination: { pageSize: 20 },
                        scroll: { x: true }
                      }) : h(Empty, { image: Empty.PRESENTED_IMAGE_SIMPLE, description: "暂无会话" })
                    )
                  )
                )
              )
            )
          );
        }

        ReactDOM.createRoot(document.getElementById("root")).render(h(SessionsApp));
      })();
    </script>
  </body>
</html>`;
}

function renderSessionDetailPage(detail) {
  const pageState = { detail };
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>匿名会话详情</title>
    <link rel="stylesheet" href="/admin/assets/antd/reset.css" />
    <style>
      body { margin: 0; background: #f5f7fb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      #root { min-height: 100vh; }
      .diagnostics-shell { width: min(1400px, calc(100vw - 32px)); margin: 0 auto; padding: 24px 0 40px; }
      .code-tag { color: #667085; font-size: 12px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .error-row td { background: #fff1f0 !important; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>window.__PICTOOL_SESSION_DETAIL__ = ${escapeJsonForHtml(pageState)};</script>
    <script src="/admin/assets/react/react.production.min.js"></script>
    <script src="/admin/assets/react-dom/react-dom.production.min.js"></script>
    <script src="/admin/assets/dayjs/dayjs.min.js"></script>
    <script src="/admin/assets/antd/antd.min.js"></script>
    <script>
      (function () {
        if (!window.React || !window.ReactDOM || !window.dayjs || !window.antd) {
          document.getElementById("root").innerHTML = '<div class="diagnostics-shell"><div style="padding:16px;background:#fff;border-radius:8px">后台资源加载失败，请刷新页面或检查 /admin/assets 资源。</div></div>';
          return;
        }
        const state = window.__PICTOOL_SESSION_DETAIL__;
        const detail = state.detail;
        const h = React.createElement;
        const { Alert, Button, Card, Col, ConfigProvider, Empty, Layout, Row, Space, Statistic, Table, Tag, Typography, theme } = antd;
        const { Content } = Layout;
        const { Text, Title } = Typography;
        const flagMeta = {
          has_error: ["red", "有失败事件"],
          uploaded_no_download: ["orange", "上传后未下载"],
          export_failed: ["volcano", "导出失败"],
          upload_failed: ["magenta", "上传失败"],
          download_failed: ["red", "下载失败"],
          tool_switch_no_download: ["gold", "多次切换未下载"],
          left_after_upload: ["blue", "上传后未完成"]
        };
        const outcomeMeta = {
          completed: ["green", "已完成下载"],
          failed: ["red", "遇到失败"],
          tool_switch_no_download: ["gold", "多次切换未下载"],
          editing_unfinished: ["orange", "编辑未完成"],
          uploaded_no_download: ["volcano", "上传后未下载"],
          browsed_only: ["default", "仅浏览"],
          unknown: ["default", "未归类"]
        };
        const actionGroupMeta = {
          upload: ["blue", "上传"],
          edit: ["geekblue", "编辑"],
          export: ["purple", "导出"],
          download: ["green", "下载"],
          error: ["red", "失败"],
          navigation: ["cyan", "导航"],
          system: ["default", "系统"],
          none: ["default", "无关键行为"],
          unknown: ["default", "未知"]
        };

        function flagTag(flag) {
          const meta = flagMeta[flag] || ["default", flag];
          return h(Tag, { color: meta[0], key: flag }, meta[1]);
        }

        function outcomeTag(outcome) {
          const meta = outcomeMeta[outcome] || outcomeMeta.unknown;
          return h(Tag, { color: meta[0] }, meta[1]);
        }

        function actionGroupTag(group) {
          const meta = actionGroupMeta[group] || actionGroupMeta.unknown;
          return h(Tag, { color: meta[0] }, meta[1]);
        }

        function formatTime(value) {
          return value ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "-";
        }

        function bucketTags(row) {
          return ["size_bucket", "dimension_bucket", "target_dimension_bucket", "output_size_bucket", "output_dimension_bucket", "quality_bucket", "batch_count_bucket", "duration_bucket"].map(function (key) {
            return row[key] ? h(Tag, { key }, key.replace("_bucket", "") + ": " + row[key]) : null;
          }).filter(Boolean);
        }

        const flowColumns = [
          { title: "flow_id", dataIndex: "flow_id", render: function (value) { return h("div", { className: "code-tag" }, value); } },
          { title: "工具", dataIndex: "tool_name", render: function (_, row) { return h("div", null, row.tool_name || row.tool, h("div", { className: "code-tag" }, row.tool)); } },
          { title: "开始时间", dataIndex: "first_seen", render: formatTime },
          { title: "最后时间", dataIndex: "last_seen", render: formatTime },
          { title: "已上传", dataIndex: "uploaded", render: function (value) { return h(Tag, { color: value ? "green" : "default" }, value ? "是" : "否"); } },
          { title: "已下载", dataIndex: "downloaded", render: function (value) { return h(Tag, { color: value ? "green" : "orange" }, value ? "是" : "否"); } },
          { title: "失败", dataIndex: "failed", render: function (value) { return h(Tag, { color: value ? "red" : "default" }, value ? "是" : "否"); } },
          { title: "最后事件", dataIndex: "last_event_name_zh", render: function (_, row) { return h("div", null, row.last_event_name_zh || row.last_event_name || "-", h("div", { className: "code-tag" }, row.last_event_name || "")); } }
        ];

        const eventColumns = [
          { title: "时间", dataIndex: "server_ts", render: formatTime },
          { title: "步骤", dataIndex: "step_index", render: function (value) { return value ? "#" + value : "-"; } },
          { title: "页面", dataIndex: "page" },
          { title: "工具", dataIndex: "tool_name" },
          { title: "事件", dataIndex: "event_name_zh", render: function (_, row) { return h("div", null, row.event_name_zh || row.event_name, h("div", { className: "code-tag" }, row.event_name)); } },
          { title: "分组", dataIndex: "event_group", render: function (value) { return h(Tag, null, value || "unknown"); } },
          { title: "状态", dataIndex: "status", render: function (_, row) { return row.is_error ? h(Tag, { color: "red" }, "失败") : h(Tag, { color: "green" }, row.status || "正常"); } },
          { title: "原因", dataIndex: "reason", render: function (value) { return value ? h(Tag, { color: "red" }, value) : "-"; } },
          { title: "关键分桶", render: function (_, row) { return h(Space, { size: 4, wrap: true }, bucketTags(row)); } }
        ];

        function DetailApp() {
          const session = detail.session;
          return h(ConfigProvider, {
            theme: { algorithm: theme.defaultAlgorithm, token: { borderRadius: 8, colorPrimary: "#315cfd" } }
          },
            h(Layout, { style: { minHeight: "100vh", background: "#f5f7fb" } },
              h(Content, null,
                h("div", { className: "diagnostics-shell" },
                  h(Space, { direction: "vertical", size: 16, style: { width: "100%" } },
                    h("div", null,
                      h(Button, { href: "/admin/sessions", style: { marginBottom: 12 } }, "返回会话列表"),
                      h(Title, { level: 2, style: { margin: 0 } }, "匿名会话详情"),
                      h("div", { className: "code-tag", style: { maxWidth: "100%" } }, session.session_id)
                    ),
                    session.diagnostic_summary ? h(Alert, { type: session.error_count > 0 ? "error" : "warning", showIcon: true, message: session.diagnostic_summary }) : null,
                    h(Card, { bordered: false },
                      h(Space, { direction: "vertical", size: 12, style: { width: "100%" } },
                        h(Space, { size: 8, wrap: true }, session.problem_flags.length ? session.problem_flags.map(flagTag) : h(Tag, { color: "green" }, "正常完成")),
                        h(Row, { gutter: [16, 16] },
                          h(Col, { xs: 12, md: 6 }, h(Statistic, { title: "事件数", value: session.event_count })),
                          h(Col, { xs: 12, md: 6 }, h(Statistic, { title: "访问页面", value: session.page_count })),
                          h(Col, { xs: 12, md: 6 }, h(Statistic, { title: "上传", value: session.upload_count })),
                          h(Col, { xs: 12, md: 6 }, h(Statistic, { title: "编辑", value: session.edit_count })),
                          h(Col, { xs: 12, md: 6 }, h(Statistic, { title: "下载", value: session.download_count })),
                          h(Col, { xs: 12, md: 6 }, h(Statistic, { title: "失败", value: session.error_count })),
                          h(Col, { xs: 12, md: 6 }, h(Statistic, { title: "是否完成下载", value: session.completed_download ? "是" : "否" }))
                        ),
                        h(Space, { size: 8, wrap: true },
                          h(Tag, null, "最后事件时间：" + formatTime(session.last_event_at || session.last_seen)),
                          h(Tag, null, "最后行为时间：" + formatTime(session.last_action_at)),
                          actionGroupTag(session.last_action_group),
                          outcomeTag(session.session_outcome)
                        ),
                        h(Text, { type: "secondary" }, "最后关键行为：" + (session.last_action_name_zh || session.last_action_name || "仅浏览"))
                      )
                    ),
                    h(Card, { title: "Flow 列表", bordered: false },
                      detail.flows.length ? h(Table, { rowKey: "flow_id", size: "middle", columns: flowColumns, dataSource: detail.flows, pagination: false, scroll: { x: true } }) : h(Empty, { image: Empty.PRESENTED_IMAGE_SIMPLE, description: "暂无 flow" })
                    ),
                    h(Card, { title: "事件时间线", bordered: false },
                      detail.events.length ? h(Table, {
                        rowKey: function (row, index) { return [row.step_index, row.event_name, row.server_ts, index].join("-"); },
                        size: "middle",
                        columns: eventColumns,
                        dataSource: detail.events,
                        pagination: false,
                        rowClassName: function (row) { return row.is_error ? "error-row" : ""; },
                        scroll: { x: true }
                      }) : h(Empty, { image: Empty.PRESENTED_IMAGE_SIMPLE, description: "该会话暂无可展示事件。" })
                    )
                  )
                )
              )
            )
          );
        }

        ReactDOM.createRoot(document.getElementById("root")).render(h(DetailApp));
      })();
    </script>
  </body>
</html>`;
}

router.get("/sessions", async (req, res) => {
  try {
    const range = getDateRange(req.query);
    const sessions = await getSessions(range, {
      filter: req.query.filter || "all",
      outcome: req.query.outcome || "all",
      tool: req.query.tool || "",
      limit: req.query.limit || 200,
      offset: req.query.offset || 0
    });
    return res.type("html").send(renderSessionsPage(
      range,
      sessions,
      req.query.filter || "all",
      req.query.outcome || "all",
      req.query.tool || ""
    ));
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).send("Invalid date range.");
    console.error("[admin] sessions_render_failed", { code: error.code || "unknown" });
    return res.status(500).send("Server error.");
  }
});

router.get("/sessions/:session_id", async (req, res) => {
  try {
    const detail = await getSessionDetail(req.params.session_id);
    if (!detail) return res.status(404).send("Session not found.");
    return res.type("html").send(renderSessionDetailPage(detail));
  } catch (error) {
    console.error("[admin] session_detail_render_failed", { code: error.code || "unknown" });
    return res.status(500).send("Server error.");
  }
});

router.get("/metrics", async (req, res) => {
  try {
    const range = getDateRange(req.query);
    const [data, insights] = await Promise.all([
      getDashboardMetrics(range),
      listInsights(range)
    ]);
    return res.type("html").send(renderDashboard(range, data, insights));
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).send("Invalid date range.");
    }
    console.error("[admin] render_failed", { code: error.code || "unknown" });
    return res.status(500).send("Server error.");
  }
});

module.exports = router;
