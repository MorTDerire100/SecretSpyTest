export enum PlayerID {
  player0 = 0,
  player1 = 1,
}

export function otherPlayer(player: PlayerID): PlayerID {
  return player === PlayerID.player0 ? PlayerID.player1 : PlayerID.player0;
}
