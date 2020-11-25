import { ensureManager, useManager } from '../entities/Account';
import { ensureAdapterBlacklistSetting, useAdapterBlacklistSetting } from '../entities/AdapterBlacklistSetting';
import { ensureContract } from '../entities/Contract';
import { useFund } from '../entities/Fund';
import { extractIntegrationAdapters } from '../entities/IntegrationAdapter';
import { usePolicy } from '../entities/Policy';
import { ensureTransaction } from '../entities/Transaction';
import { AddressesAdded, AddressesRemoved } from '../generated/AdapterBlacklistContract';
import { ComptrollerLibContract } from '../generated/ComptrollerLibContract';
import { AdapterBlacklistAddressesAddedEvent, AdapterBlacklistAddressesRemovedEvent } from '../generated/schema';
import { arrayDiff } from '../utils/arrayDiff';
import { arrayUnique } from '../utils/arrayUnique';
import { genericId } from '../utils/genericId';

export function handleAddressesAdded(event: AddressesAdded): void {
  let comptroller = ComptrollerLibContract.bind(event.params.comptrollerProxy);
  let vault = comptroller.getVaultProxy();
  let policy = usePolicy(event.address.toHex());
  let items = event.params.items.map<string>((item) => item.toHex());

  let addressesAdded = new AdapterBlacklistAddressesAddedEvent(genericId(event));
  addressesAdded.fund = vault.toHex(); // fund does not exist yet
  addressesAdded.account = ensureManager(event.transaction.from, event).id;
  addressesAdded.contract = ensureContract(event.address, 'AdapterBlacklist').id;
  addressesAdded.timestamp = event.block.timestamp;
  addressesAdded.transaction = ensureTransaction(event).id;
  addressesAdded.comptrollerProxy = event.params.comptrollerProxy.toHex();
  addressesAdded.items = items;
  addressesAdded.save();

  let adapterIds = extractIntegrationAdapters(items).map<string>((adapter) => adapter.id);

  let setting = ensureAdapterBlacklistSetting(vault.toHex(), policy);
  setting.listed = arrayUnique<string>(setting.listed.concat(items));
  setting.adapters = arrayUnique<string>(setting.adapters.concat(adapterIds));
  setting.events = arrayUnique<string>(setting.events.concat([addressesAdded.id]));
  setting.timestamp = event.block.timestamp;
  setting.save();
}

export function handleAddressesRemoved(event: AddressesRemoved): void {
  let comptroller = ComptrollerLibContract.bind(event.params.comptrollerProxy);
  let vault = comptroller.getVaultProxy();
  let fund = useFund(vault.toHex());
  let policy = usePolicy(event.address.toHex());
  let items = event.params.items.map<string>((item) => item.toHex());

  let addressesRemoved = new AdapterBlacklistAddressesRemovedEvent(genericId(event));
  addressesRemoved.fund = fund.id;
  addressesRemoved.account = useManager(event.transaction.from.toHex()).id;
  addressesRemoved.contract = event.address.toHex();
  addressesRemoved.timestamp = event.block.timestamp;
  addressesRemoved.transaction = ensureTransaction(event).id;
  addressesRemoved.comptrollerProxy = event.params.comptrollerProxy.toHex();
  addressesRemoved.items = items;
  addressesRemoved.save();

  let adapterIds = extractIntegrationAdapters(items).map<string>((adapter) => adapter.id);

  let setting = useAdapterBlacklistSetting(fund, policy);
  setting.listed = arrayDiff<string>(setting.listed, items);
  setting.adapters = arrayDiff<string>(setting.adapters, adapterIds);
  setting.events = arrayUnique<string>(setting.events.concat([addressesRemoved.id]));
  setting.timestamp = event.block.timestamp;
  setting.save();
}
