import { BigDecimal, Entity, ethereum } from '@graphprotocol/graph-ts';
import { Fee, FeePayout, Fund } from '../generated/schema';
import { arrayUnique } from '../utils/arrayUnique';
import { logCritical } from '../utils/logCritical';
import { ensureManagementFeePayout, ensurePerformanceFeePayout } from './IndividualFeePayout';
import { ensureState } from './State';

function feePayoutId(fund: Fund, event: ethereum.Event): string {
  return fund.id + '/' + event.block.timestamp.toString() + '/payout';
}

export function createFeePayout(
  feePayoutIds: string[],
  fund: Fund,
  event: ethereum.Event,
  cause: Entity | null,
): FeePayout {
  let payout = new FeePayout(feePayoutId(fund, event));
  payout.timestamp = event.block.timestamp;
  payout.fund = fund.id;
  payout.shares = BigDecimal.fromString('0');
  payout.individualPayouts = feePayoutIds;
  payout.events = cause ? [cause.getString('id')] : [];
  payout.save();

  return payout;
}

export function ensureFeePayout(fund: Fund, event: ethereum.Event, cause: Entity): FeePayout {
  let feePayout = FeePayout.load(feePayoutId(fund, event)) as FeePayout;

  if (!feePayout) {
    feePayout = createFeePayout([], fund, event, cause);
  } else {
    let events = feePayout.events;
    feePayout.events = arrayUnique<string>(events.concat([cause.getString('id')]));
    feePayout.save();
  }

  return feePayout;
}

export function useFeePayout(id: string): FeePayout {
  let feePayout = FeePayout.load(id) as FeePayout;
  if (feePayout == null) {
    logCritical('Failed to load payout entity {}.', [id]);
  }

  return feePayout;
}

export function trackFeePayout(
  fund: Fund,
  fee: Fee,
  shares: BigDecimal,
  event: ethereum.Event,
  cause: Entity,
): FeePayout {
  let feePayout = ensureFeePayout(fund, event, cause);
  feePayout.shares = feePayout.shares.plus(shares);

  if (fee.identifier == 'MANAGEMENT') {
    let e = event 
    feePayout.individualPayouts = feePayout.individualPayouts.concat([
      ensureManagementFeePayout(fund, fee, shares, event, cause).id,
    ]);
  }

  if (fee.identifier == 'PERFORMANCE') {
    feePayout.individualPayouts = feePayout.individualPayouts.concat([
      ensurePerformanceFeePayout(fund, fee, shares, event, cause).id,
    ]);
  }

  feePayout.save();

  let state = ensureState(fund, event);
  let events = state.events;
  state.events = arrayUnique<string>(events.concat(feePayout.events));
  state.feePayout = feePayout.id;
  state.save();

  fund.feePayout = feePayout.id;
  fund.save();

  return feePayout;
}
