self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Soft Spark";
  const body = data.body || "";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: {
        matchId: data.matchId,
        type: data.type,
        state: data.state,
        band: data.band,
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const matchId = event.notification.data && event.notification.data.matchId;
  const url = matchId ? `/matches/${matchId}/invite` : "/matches";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate?.(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
