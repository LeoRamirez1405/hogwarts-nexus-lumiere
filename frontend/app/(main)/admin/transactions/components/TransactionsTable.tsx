"use client";

import { Transaction } from "@/lib/api";
import GlassCard from "@/components/ui/GlassCard";
import Avatar from "@/components/ui/Avatar";
import ListFooter from "@/components/ui/ListFooter";
import { MaterialIcon } from "@/components/ui";
import { VirtualizedList } from "@/components/ui/VirtualizedGrid";
import {
  txIcon,
  txTypeLabel,
  formatAmount,
  formatTime,
  getInitials,
  getActorName,
  getActorAvatar,
  getAmountPrefix,
  getAmountColor,
} from "../utils";
import type { ListFooterProps } from "../types";

interface TransactionsTableProps {
  txs: Transaction[];
  listFooterProps: ListFooterProps;
}

export default function TransactionsTable({ txs, listFooterProps }: TransactionsTableProps) {
  const rowHeight = 72;

  const renderTransactionRow = (tx: Transaction, index: number, style: React.CSSProperties) => {
    const { icon, color } = txIcon(tx.type);
    return (
      <div style={style} key={tx.id}>
        <tr className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-container-low/50 transition-colors">
          <td className="px-6 py-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}
              >
                <MaterialIcon name={icon} className="text-lg" />
              </div>
              <div className="min-w-0">
                <p className="text-body-md text-on-surface">
                  {txTypeLabel(tx.type)}
                </p>
                <p className="text-label-sm text-on-surface-variant md:hidden truncate max-w-[200px]">
                  {tx.description || "-"}
                </p>
              </div>
            </div>
          </td>
          <td className="px-6 py-4 hidden md:table-cell">
            {tx.type === "transfer" && tx.sender && tx.receiver ? (
              <div className="flex items-center gap-1">
                <Avatar
                  initials={tx.sender.name.charAt(0).toUpperCase()}
                  src={tx.sender.avatar_url}
                  size="sm"
                />
                <MaterialIcon
                  name="arrow_forward"
                  className="text-outline-variant text-sm"
                />
                <Avatar
                  initials={tx.receiver.name.charAt(0).toUpperCase()}
                  src={tx.receiver.avatar_url}
                  size="sm"
                />
                <span className="text-label-sm text-on-surface-variant ml-1">
                  {tx.sender.name} → {tx.receiver.name}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Avatar
                  initials={getInitials(getActorName(tx))}
                  src={getActorAvatar(tx)}
                  size="sm"
                />
                <p className="text-body-md text-on-surface truncate max-w-[150px]">
                  {getActorName(tx)}
                </p>
              </div>
            )}
          </td>
          <td className="px-6 py-4 hidden md:table-cell">
            <p className="text-label-sm text-on-surface-variant truncate max-w-[200px]">
              {tx.description || "—"}
            </p>
          </td>
          <td className="px-6 py-4 hidden sm:table-cell">
            <p className="text-label-sm text-on-surface-variant">
              {formatTime(tx.created_at)}
            </p>
          </td>
          <td className="px-6 py-4 text-right">
            <p className={`font-display text-title-md ${getAmountColor(tx.type)}`}>
              {getAmountPrefix(tx.type)}
              {formatAmount(tx.amount)}
            </p>
          </td>
        </tr>
      </div>
    );
  };

  return (
    <GlassCard className="hidden md:block">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 bg-surface-container">
            <tr className="border-b border-outline-variant/20">
              <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium">
                Tipo
              </th>
              <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden md:table-cell">
                Usuario
              </th>
              <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden md:table-cell">
                Descripción
              </th>
              <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden sm:table-cell">
                Fecha
              </th>
              <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium text-right">
                Monto
              </th>
            </tr>
          </thead>
<tbody>
            <VirtualizedList
              items={txs}
              itemHeight={rowHeight}
              loadingMore={listFooterProps.loading}
              loadMoreSentinel={
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-on-surface-variant">
                      <MaterialIcon name="sync" className="animate-spin text-primary" />
                      <span>Cargando más...</span>
                    </div>
                  </td>
                </tr>
              }
              sentinelRef={undefined}
              overscanCount={5}
              renderItem={renderTransactionRow}
            />
            {txs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <MaterialIcon
                    name="receipt_long"
                    className="text-5xl text-outline-variant mb-3 block mx-auto"
                  />
                  <p className="text-on-surface-variant text-body-md">
                    No hay transacciones
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ListFooter {...listFooterProps} />
    </GlassCard>
  );
}