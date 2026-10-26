"use client";
import DataTable from "@/components/common/DataTable";
import type { Segment } from "@ee/types/segments";
import SegmentsEmptyState from "./SegmentsEmptyState";
import {
  getSegmentsTableColumns,
  type SegmentRowActions,
} from "./SegmentsTableColumns";

interface Props {
  segments: Segment[];
  loading: boolean;
  archived: boolean;
  truncated: boolean;
  actions: SegmentRowActions;
  onOpen: (segment: Segment) => void;
  onCreate?: () => void;
}

const SegmentsTable = ({
  segments,
  loading,
  archived,
  truncated,
  actions,
  onOpen,
  onCreate,
}: Props) => {
  const columns = getSegmentsTableColumns(actions);
  return (
    <DataTable
      columns={columns}
      data={segments}
      selectedColumns={columns.map((c) => c.accessorKey as string)}
      onRowClick={onOpen}
      getRowId={(s) => s.id}
      getRowAriaLabel={(s) => `Open segment ${s.name}`}
      loading={loading}
      headerClassName={(id) => (id === "id" ? "w-12 text-right" : undefined)}
      cellClassName={(id) => (id === "id" ? "w-12 text-right" : undefined)}
      ariaLabel="Segments"
      emptyState={
        <SegmentsEmptyState onCreate={onCreate} isArchived={archived} />
      }
      footerContent={
        truncated ? (
          <p className="text-xs text-muted-foreground">
            Showing the 200 most recently updated segments.
          </p>
        ) : undefined
      }
    />
  );
};

export default SegmentsTable;
