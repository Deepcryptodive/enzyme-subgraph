import { BigDecimal } from '@graphprotocol/graph-ts';
import { ensureAccount } from '../entities/Account';
import { ensureEntranceRateBurnFeeSetting } from '../entities/EntranceRateBurnFeeSetting';
import { entranceRateBurnFeeStateId, useEntranceRateBurnFeeState } from '../entities/EntranceRateBurnFeeState';
import { useFee } from '../entities/Fee';
import { trackFeeState } from '../entities/FeeState';
import { useFund } from '../entities/Fund';
import { ensureTransaction } from '../entities/Transaction';
import { ComptrollerLibContract } from '../generated/ComptrollerLibContract';
import { FundSettingsAdded, Settled } from '../generated/EntranceRateBurnFeeContract';
import { EntranceRateBurnFeeSettingsAddedEvent, EntranceRateBurnFeeSettledEvent } from '../generated/schema';
import { arrayUnique } from '../utils/arrayUnique';
import { genericId } from '../utils/genericId';
import { toBigDecimal } from '../utils/toBigDecimal';

export function handleFundSettingsAdded(event: FundSettingsAdded): void {
  let comptroller = ComptrollerLibContract.bind(event.params.comptrollerProxy);
  let vault = comptroller.getVaultProxy();
  let fee = useFee(event.address.toHex());
  let rate = toBigDecimal(event.params.rate);

  let feeSettings = new EntranceRateBurnFeeSettingsAddedEvent(genericId(event));
  feeSettings.fund = vault.toHex(); // fund does not exist yet
  feeSettings.account = ensureAccount(event.transaction.from, event).id;
  feeSettings.timestamp = event.block.timestamp;
  feeSettings.transaction = ensureTransaction(event).id;
  feeSettings.comptrollerProxy = event.params.comptrollerProxy.toHex();
  feeSettings.rate = rate;
  feeSettings.save();

  let setting = ensureEntranceRateBurnFeeSetting(vault.toHex(), fee);
  setting.rate = rate;
  setting.events = arrayUnique<string>(setting.events.concat([feeSettings.id]));
  setting.timestamp = event.block.timestamp;
  setting.save();
}

export function handleSettled(event: Settled): void {
  let comptroller = ComptrollerLibContract.bind(event.params.comptrollerProxy);
  let fund = useFund(comptroller.getVaultProxy().toHex());
  let fee = useFee(event.address.toHex());
  let shares = toBigDecimal(event.params.sharesQuantity);

  let settled = new EntranceRateBurnFeeSettledEvent(genericId(event));
  settled.fund = fund.id;
  settled.account = ensureAccount(event.transaction.from, event).id;
  settled.timestamp = event.block.timestamp;
  settled.transaction = ensureTransaction(event).id;
  settled.comptrollerProxy = event.params.comptrollerProxy.toHex();
  settled.sharesQuantity = shares;
  settled.payer = event.params.payer.toHex();
  settled.save();

  trackFeeState(fund, fee, BigDecimal.fromString('0'), event, settled);

  let entranceRateBurnFeeState = useEntranceRateBurnFeeState(entranceRateBurnFeeStateId(fund, event));
  entranceRateBurnFeeState.lastSettled = event.block.timestamp;
  entranceRateBurnFeeState.save();
}
