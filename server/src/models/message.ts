export class Message {
  senderUuid: string;
  senderUsername: string;

  content: string;
  roomUuid: string;
  sent_at: Date;

  constructor(senderUuid: string, senderUsername: string, content: string, roomUuid: string, sent_at: Date) {
    this.senderUuid = senderUuid;
    this.senderUsername = senderUsername;
    this.content = content;
    this.roomUuid = roomUuid;
    this.sent_at = sent_at;
  }
}
