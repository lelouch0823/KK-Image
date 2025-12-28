import sentryPlugin from "@cloudflare/pages-plugin-sentry";
import '@sentry/tracing';

export async function errorHandling(context) {
  const env = context.env;
  if (typeof env.disable_telemetry == "undefined" || env.disable_telemetry == null || env.disable_telemetry == "") {
    context.data.telemetry = true;
    let remoteSampleRate = 0.001;
    try {
      const sampleRate = await fetchSampleRate(context)
      // sampleRate 获取成功
      if (sampleRate) {
        remoteSampleRate = sampleRate;
      }
    } catch (e) { /* 忽略采样率获取失败 */ }
    const sampleRate = env.sampleRate || remoteSampleRate;

    // 从环境变量读取 Sentry DSN，如未配置则使用默认值
    const sentryDsn = env.SENTRY_DSN || "https://219f636ac7bde5edab2c3e16885cb535@o4507041519108096.ingest.us.sentry.io/4507541492727808";

    return sentryPlugin({
      dsn: sentryDsn,
      tracesSampleRate: sampleRate,
    })(context);;
  }
  return context.next();
}

export function telemetryData(context) {
  const env = context.env;
  if (typeof env.disable_telemetry == "undefined" || env.disable_telemetry == null || env.disable_telemetry == "") {
    try {
      const parsedHeaders = {};
      context.request.headers.forEach((value, key) => {
        parsedHeaders[key] = value
        //check if the value is empty
        if (value.length > 0) {
          context.data.sentry.setTag(key, value);
        }
      });
      const CF = JSON.parse(JSON.stringify(context.request.cf));
      const parsedCF = {};
      for (const key in CF) {
        if (typeof CF[key] == "object") {
          parsedCF[key] = JSON.stringify(CF[key]);
        } else {
          parsedCF[key] = CF[key];
          if (CF[key].length > 0) {
            context.data.sentry.setTag(key, CF[key]);
          }
        }
      }
      const data = {
        headers: parsedHeaders,
        cf: parsedCF,
        url: context.request.url,
        method: context.request.method,
        redirect: context.request.redirect,
      }
      //get the url path
      const urlPath = new URL(context.request.url).pathname;
      const hostname = new URL(context.request.url).hostname;
      context.data.sentry.setTag("path", urlPath);
      context.data.sentry.setTag("url", data.url);
      context.data.sentry.setTag("method", context.request.method);
      context.data.sentry.setTag("redirect", context.request.redirect);
      context.data.sentry.setContext("request", data);
      const transaction = context.data.sentry.startTransaction({ name: `${context.request.method} ${hostname}` });
      //add the transaction to the context
      context.data.transaction = transaction;
      return context.next();
    } catch (e) {
      // Telemetry 数据收集失败，静默忽略
    } finally {
      context.data.transaction.finish();
    }
  }
  return context.next();
}

export async function traceData(context, span, op, name) {
  const data = context.data
  if (data.telemetry) {
    if (span) {
      // span 完成
      span.finish();
    } else {
      // span 开始
      span = await context.data.transaction.startChild(
        { op: op, name: name },
      );
    }
  }
}

async function fetchSampleRate(context) {
  const data = context.data
  if (data.telemetry) {
    const url = "https://frozen-sentinel.pages.dev/signal/sampleRate.json";
    const response = await fetch(url);
    const json = await response.json();
    return json.rate;
  }
}