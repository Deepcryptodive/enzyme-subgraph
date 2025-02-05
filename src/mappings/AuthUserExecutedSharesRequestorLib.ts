import { Address, dataSource, store } from '@graphprotocol/graph-ts';
import { ensureAccount } from '../entities/Account';
import { ensureAsset } from '../entities/Asset';
import { ensureComptrollerProxy } from '../entities/ComptrollerProxy';
import { useFund } from '../entities/Fund';
import { sharesRequestId } from '../entities/SharesRequest';
import { deleteSharesRequestExecutor, ensureSharesRequestExecutor } from '../entities/SharesRequestExecutor';
import { ensureSharesRequestor } from '../entities/SharesRequestor';
import { ensureTransaction } from '../entities/Transaction';
import {
  RequestCanceled,
  RequestCreated,
  RequestExecuted,
  RequestExecutorAdded,
  RequestExecutorRemoved,
} from '../generated/AuthUserExecutedSharesRequestorLibContract';
import {
  RequestCanceledEvent,
  RequestCreatedEvent,
  RequestExecutorAddedEvent,
  RequestExecutorRemovedEvent,
  SharesRequest,
} from '../generated/schema';
import { genericId } from '../utils/genericId';
import { toBigDecimal } from '../utils/toBigDecimal';

export function handleRequestCanceled(event: RequestCanceled): void {
  let fund = useFund(dataSource.context().getString('vaultProxy'));
  let comptrollerProxy = ensureComptrollerProxy(Address.fromString(fund.accessor), event);
  let account = ensureAccount(event.transaction.from, event);
  let sharesRequestor = ensureSharesRequestor(event.address.toHex(), fund);

  let investmentAmount = toBigDecimal(
    event.params.investmentAmount,
    ensureAsset(Address.fromString(comptrollerProxy.denominationAsset)).decimals,
  );
  let minSharesQuantity = toBigDecimal(event.params.minSharesQuantity);

  let canceled = new RequestCanceledEvent(genericId(event));
  canceled.timestamp = event.block.timestamp;
  canceled.fund = fund.id;
  canceled.sharesRequestor = sharesRequestor.id;
  canceled.type = 'CANCELED';
  canceled.investmentAmount = investmentAmount;
  canceled.minSharesQuantity = minSharesQuantity;
  canceled.transaction = ensureTransaction(event).id;
  canceled.save();

  store.remove('SharesRequest', sharesRequestId(fund, account));
}

export function handleRequestCreated(event: RequestCreated): void {
  let fund = useFund(dataSource.context().getString('vaultProxy'));
  let comptrollerProxy = ensureComptrollerProxy(Address.fromString(fund.accessor), event);

  let account = ensureAccount(event.transaction.from, event);
  let sharesRequestor = ensureSharesRequestor(event.address.toHex(), fund);

  let investmentAmount = toBigDecimal(
    event.params.investmentAmount,
    ensureAsset(Address.fromString(comptrollerProxy.denominationAsset)).decimals,
  );
  let minSharesQuantity = toBigDecimal(event.params.minSharesQuantity);

  let created = new RequestCreatedEvent(genericId(event));
  created.timestamp = event.block.timestamp;
  created.fund = fund.id;
  created.sharesRequestor = sharesRequestor.id;
  created.type = 'CREATED';
  created.investmentAmount = investmentAmount;
  created.minSharesQuantity = minSharesQuantity;
  created.transaction = ensureTransaction(event).id;
  created.save();

  let id = sharesRequestId(fund, account);
  let request = new SharesRequest(id);
  request.timestamp = event.block.timestamp;
  request.sharesRequestor = sharesRequestor.id;
  request.account = account.id;
  request.fund = fund.id;
  request.investmentAmount = investmentAmount;
  request.minSharesQuantity = minSharesQuantity;
  request.save();
}

export function handleRequestExecuted(event: RequestExecuted): void {
  let fund = useFund(dataSource.context().getString('vaultProxy'));
  let comptrollerProxy = ensureComptrollerProxy(Address.fromString(fund.accessor), event);

  let account = ensureAccount(event.transaction.from, event);
  let sharesRequestor = ensureSharesRequestor(event.address.toHex(), fund);

  let investmentAmount = toBigDecimal(
    event.params.investmentAmount,
    ensureAsset(Address.fromString(comptrollerProxy.denominationAsset)).decimals,
  );
  let minSharesQuantity = toBigDecimal(event.params.minSharesQuantity);

  let created = new RequestCreatedEvent(genericId(event));
  created.timestamp = event.block.timestamp;
  created.fund = fund.id;
  created.sharesRequestor = sharesRequestor.id;
  created.type = 'EXECUTED';
  created.investmentAmount = investmentAmount;
  created.minSharesQuantity = minSharesQuantity;
  created.transaction = ensureTransaction(event).id;
  created.save();

  store.remove('SharesRequest', sharesRequestId(fund, account));
}

export function handleRequestExecutorAdded(event: RequestExecutorAdded): void {
  let fund = useFund(dataSource.context().getString('vaultProxy'));
  let sharesRequestor = ensureSharesRequestor(event.address.toHex(), fund);
  let executor = ensureAccount(event.params.account, event);

  let added = new RequestExecutorAddedEvent(genericId(event));
  added.timestamp = event.block.timestamp;
  added.fund = fund.id;
  added.sharesRequestor = sharesRequestor.id;
  added.requestExecutor = executor.id;
  added.transaction = ensureTransaction(event).id;
  added.save();

  ensureSharesRequestExecutor(sharesRequestor, executor, event);
}

export function handleRequestExecutorRemoved(event: RequestExecutorRemoved): void {
  let fund = useFund(dataSource.context().getString('vaultProxy'));
  let sharesRequestor = ensureSharesRequestor(event.address.toHex(), fund);
  let executor = ensureAccount(event.params.account, event);

  let removed = new RequestExecutorRemovedEvent(genericId(event));
  removed.timestamp = event.block.timestamp;
  removed.fund = fund.id;
  removed.sharesRequestor = sharesRequestor.id;
  removed.requestExecutor = executor.id;
  removed.transaction = ensureTransaction(event).id;
  removed.save();

  deleteSharesRequestExecutor(sharesRequestor, executor);
}
