import { IKalenderEvent, KalenderEvents } from "kalender-events";
import day from "dayjs";
import tzP from "dayjs/plugin/timezone";
import rtP from "dayjs/plugin/relativeTime";
import ibtP from "dayjs/plugin/isBetween";

day.extend(tzP);
day.extend(rtP);
day.extend(ibtP);

const ev = new KalenderEvents({
  type: "ical",
  url: "webcal://p206-caldav.icloud.com.cn/published/2/MTcwMzQzMzA1NTQxNzAzNE8tFwMfukUWyUn-lgHOZZA46drR9jNxkc-tMG74CQWMV60m2y3hioe1FQPfbujPI3CIiMjfS5ZEGmq8FFvlhYg",
});

import express from "express";

const app = express();

let evs: IKalenderEvent[] = [];

let updatedTS: day.Dayjs | null;

let tOld = day();
let tNew = day();

let uOld = day();
let uNew = day();

async function upd() {
  try {
    evs = await ev.getEvents({
      now: new Date(),
      preview: 10,
      timezone: "Asia/Shanghai",
    });
    updatedTS = day();
    return "ok";
  } catch (e) {
    console.log(e);
    return "error";
  }
}

let uevC = 0;

async function updateEv() {
  let status = "error";

  while (status !== "ok") {
    status = await upd();

    if (status === "error") console.log("error, retrying in 0.5s");

    await new Promise((resolve) => setTimeout(resolve, 500)); // 0.5s delay
  }

  console.log("updated" + uevC++);

  return;
}

app.post("/update", async (_req, res) => {
  await updateEv();

  res.send("ok");
});

let rqC = 0;

app.get("/nextAndCurr", async (req, res) => {
  tNew = day();
  console.log(
    rqC++,
    ": last request was",
    tNew.diff(tOld, "seconds"),
    "ago",
    "||",
    "last update was",
    uNew.diff(uOld, "seconds"),
    "ago"
  );
  tOld = tNew;

  uNew = day();
  if (uNew.diff(uOld, "seconds") > 120) {
    console.log("2 mins since last update, updating...");
    await updateEv();
    uOld = uNew;
  }

  const curr = evs
    .filter((e) => {
      return day().isBetween(day(e.eventStart), day(e.eventEnd));
    })
    .map((e) => ({
      title: e.summary,
      relDate: "ends in " + day(e.eventEnd).fromNow(true),
      absStart: e.eventStart,
      absEnd: e.eventEnd,
      description: e.description,
      durationSeconds: e.durationSeconds,
      location: e.location,
    }));

  const next = evs
    .filter((e) => {
      return (
        !day().isBetween(day(e.eventStart), day(e.eventEnd)) &&
        !day().isAfter(day(e.eventEnd))
      );
    })
    .map((e) => ({
      title: e.summary,
      relDate: "starts in " + day(e.eventStart).fromNow(true),
      absStart: e.eventStart,
      absEnd: e.eventEnd,
      description: e.description,
      durationSeconds: e.durationSeconds,
      location: e.location,
    }))
    .slice(0, 3);

  res.json({
    curr: curr[0]
      ? curr[0]
      : {
          title: "nothing",
          relDate: "starts at notime",
          absStart: "notime",
          absEnd: "notime",
          description: "nothing",
          durationSeconds: 0,
          location: "nowhere",
        },
    next,
    dataAge: updatedTS?.fromNow() || "never",
  });
});

app.listen(3000, async () => {
  console.log("server started");
  await updateEv();
});
