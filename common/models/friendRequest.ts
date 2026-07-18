export class FriendRequest {
  senderUuid: string;
  receiverUuid: string;
  sent_at: Date;

  constructor(senderUuid: string, receiverUuid: string, sent_at: Date) {
    this.senderUuid = senderUuid;
    this.receiverUuid = receiverUuid;
    this.sent_at = sent_at;
  }
}
