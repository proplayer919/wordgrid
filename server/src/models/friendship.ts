export class Friendship {
  userAUuid: string;
  userBUuid: string;
  created_at: Date;

  constructor(userAUuid: string, userBUuid: string, created_at: Date) {
    this.userAUuid = userAUuid;
    this.userBUuid = userBUuid;
    this.created_at = created_at;
  }
}
