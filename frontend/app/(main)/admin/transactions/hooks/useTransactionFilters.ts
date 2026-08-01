"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, User } from "@/lib/api";
import type { TransactionFilters, TxTypeFilter, TabType } from "../types";

export function useTransactionFilters() {
  const [filter, setFilter] = useState<TxTypeFilter>("all");
  const [activeTab, setActiveTab] = useState<TabType>("admin");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [userFilterQuery, setUserFilterQuery] = useState("");
  const [userFilterResults, setUserFilterResults] = useState<User[]>([]);
  const [selectedUserFilter, setSelectedUserFilter] = useState<User | null>(null);
  const [userFilterSearching, setUserFilterSearching] = useState(false);
  const userFilterQueryRef = useRef("");

  useEffect(() => {
    userFilterQueryRef.current = userFilterQuery;
  }, [userFilterQuery]);

  useEffect(() => {
    if (!userFilterQuery || userFilterQuery.length < 2) {
      return;
    }
    const timer = setTimeout(() => {
      setUserFilterSearching(true);
      api
        .searchUsersServer(userFilterQuery, { limit: 20 })
        .then((page) => {
          if (userFilterQueryRef.current !== userFilterQuery) return;
          setUserFilterResults(page.items);
        })
        .catch(() => {
          if (userFilterQueryRef.current === userFilterQuery) {
            setUserFilterResults([]);
          }
        })
        .finally(() => {
          if (userFilterQueryRef.current === userFilterQuery) setUserFilterSearching(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [userFilterQuery]);

  const buildFilters = useCallback(
    (): TransactionFilters => ({
      type: filter === "all" ? undefined : filter,
      userId: selectedUserFilter?.id,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [filter, selectedUserFilter, dateFrom, dateTo]
  );

  const clearUserFilter = useCallback(() => {
    setSelectedUserFilter(null);
    setUserFilterQuery("");
  }, []);

  const selectUserFilter = useCallback((u: User) => {
    setSelectedUserFilter(u);
    setUserFilterQuery(u.name);
    setUserFilterResults([]);
  }, []);

  const clearDateRange = useCallback(() => {
    setDateFrom("");
    setDateTo("");
  }, []);

  return {
    filter,
    setFilter,
    activeTab,
    setActiveTab,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    userFilterQuery,
    setUserFilterQuery,
    selectedUserFilter,
    userFilterResults,
    userFilterSearching,
    buildFilters,
    clearUserFilter,
    clearDateRange,
    selectUserFilter,
  };
}