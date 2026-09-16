import type * as Party from "partykit/server";

/** Band/invite events only — never chat or transcripts. */
export default class MatchParty implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "hello", room: this.room.id }));
  }

  async onRequest(req: Party.Request) {
    if (req.method === "POST") {
      const event = await req.json();
      this.room.broadcast(JSON.stringify(event));
      return new Response("ok");
    }
    return new Response("soft-spark realtime (band + invite only)");
  }
}
