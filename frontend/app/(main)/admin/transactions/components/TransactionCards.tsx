"use client";

import { Transaction } from "@/lib/api";
import GlassCard from "@/components/ui/GlassCard";
import Avatar from "@/components/ui/Avatar";
import ListFooter from "@/components/ui/ListFooter";
import { MaterialIcon } from "@/components/ui";
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

interface TransactionCardsProps {
  txs: Transaction[];
  listFooterProps: ListFooterProps;
}

export default function TransactionCards({ txs, listFooterProps }: TransactionCardsProps) {
  return (
    <div className="md:hidden space-y-3">
      {txs.map((tx) => {
        const { icon, color } = txIcon(tx.type);
        const isTransfer = tx.type === "transfer";
        return (
          <GlassCard key={tx.id} className="p-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}
              >
                <MaterialIcon name={icon} className="text-xl" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-body-md font-medium text-on-surface">
                    {txTypeLabel(tx.type)}
                  </p>
                  <p className={`font-display text-title-md shrink-0 ${getAmountColor(tx.type)}`}>
                    {getAmountPrefix(tx.type)}
                    {formatAmount(tx.amount)}
                  </p>
                </div>
                <div className="mt-2">
                  {isTransfer && tx.sender && tx.receiver ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-label-sm text-on-surface-variant w-10 shrink-0">De:</span>
                        <Avatar
                          initials={tx.sender.name.charAt(0).toUpperCase()}
                          src={tx.sender.avatar_url}
                          size="sm"
                        />
                        <p className="text-body-sm text-on-surface truncate">
                          {tx.sender.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-label-sm text-on-surface-variant w-10 shrink-0">Para:</span>
                        <p className="text-body-sm text-on-surface truncate">
                          {tx.receiver.name}
                        </p>
                        <Avatar
                          initials={tx.receiver.name.charAt(0).toUpperCase()}
                          src={tx.receiver.avatar_url}
                          size="sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Avatar
                        initials={getInitials(getActorName(tx))}
                        src={getActorAvatar(tx)}
                        size="sm"
                      />
                      <p className="text-body-sm text-on-surface truncate">
                        {getActorName(tx)}
                      </p>
                    </div>
                  )}
                </div>
                {tx.description && (
                  <p className="text-label-sm text-on-surface-variant truncate mt-1">
                    {tx.description}
                  </p>
                )}
                <p className="text-label-sm text-on-surface-variant mt-1">
                  {formatTime(tx.created_at)}
                </p>
              </div>
            </div>
          </GlassCard>
        );
      })}
      {txs.length === 0 && (
        <GlassCard className="p-12 text-center">
          <MaterialIcon
            name="receipt_long"
            className="text-5xl text-outline-variant mb-3 block mx-auto"
          />
          <p className="text-on-surface-variant text-body-md">
            No hay transacciones
          </p>
        </GlassCard>
      )}
      <ListFooter {...listFooterProps} />
    </div>
  );
}