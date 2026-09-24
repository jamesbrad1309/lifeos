import { gql } from "@apollo/client";

const JOURNAL_ENTRY_FIELDS = gql`
  fragment JournalEntryFields on JournalEntry {
    id
    date
    kind
    time
    text
    tags
    durationMinutes
    emotion
    intensity
    tone
    trigger {
      id
      kind
      text
      time
    }
  }
`;

export const JOURNAL_ENTRIES_QUERY = gql`
  ${JOURNAL_ENTRY_FIELDS}
  query JournalEntries($date: String!) {
    journalEntries(date: $date) {
      ...JournalEntryFields
    }
  }
`;

export const JOURNAL_DAYS_QUERY = gql`
  query JournalDays($from: String!, $to: String!) {
    journalDays(from: $from, to: $to) {
      date
      actionCount
      feelingCount
      eventCount
      emotions
    }
  }
`;

export const CREATE_JOURNAL_ENTRIES_MUTATION = gql`
  ${JOURNAL_ENTRY_FIELDS}
  mutation CreateJournalEntries($entries: [JournalEntryDraftInput!]!) {
    createJournalEntries(entries: $entries) {
      ...JournalEntryFields
    }
  }
`;

export const UPDATE_JOURNAL_ENTRY_MUTATION = gql`
  ${JOURNAL_ENTRY_FIELDS}
  mutation UpdateJournalEntry($id: ID!, $input: JournalEntryInput!) {
    updateJournalEntry(id: $id, input: $input) {
      ...JournalEntryFields
    }
  }
`;

export const DELETE_JOURNAL_ENTRY_MUTATION = gql`
  mutation DeleteJournalEntry($id: ID!) {
    deleteJournalEntry(id: $id)
  }
`;

/**
 * Creating/deleting changes list membership and the week strip's counts,
 * which cache normalization can't infer — refetch both active queries by
 * operation name after any journal write.
 */
export const JOURNAL_REFETCH = ["JournalEntries", "JournalDays"];
