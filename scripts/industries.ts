/**
 * industries.ts — Industry configuration for multi-industry OSM collector.
 *
 * Each industry defines its OSM Overpass tags, output file paths, and
 * whether to filter out chatbot-having sites.
 *
 * To add a new industry: add an entry here, create email-bodies-{id}.ts,
 * create send-{id}.ts, and add .gitignore whitelists.
 */

import * as path from 'path';

export interface IndustryConfig {
  id: string;
  label: string;                // display name
  osmTags: string[];            // Overpass key=value pairs
  leadsFile: string;            // absolute path resolved at runtime
  stateFile: string;
  progressFile: string;
  chatbotFilter: boolean;       // skip sites that already have a chatbot?
  defaultName: string;          // fallback name for unnamed POIs
}

const LEADS_DIR = path.resolve(__dirname, '../output/leads');
const STATE_DIR = path.resolve(__dirname, '../output/v5-campaign');

export const INDUSTRIES: Record<string, IndustryConfig> = {
  dentist: {
    id: 'dentist',
    label: 'Dental practices',
    osmTags: [
      'amenity=dentist',
      'healthcare=dentist',
    ],
    leadsFile: path.join(LEADS_DIR, 'dental-v5-modern.json'),
    stateFile: path.join(STATE_DIR, 'send-state-v5.json'),
    progressFile: path.join(STATE_DIR, 'osm-region-progress.json'),
    chatbotFilter: true,
    defaultName: 'Dental Practice',
  },

  lawyer: {
    id: 'lawyer',
    label: 'Law firms',
    osmTags: [
      'office=lawyer',
      'office=law_firm',
    ],
    leadsFile: path.join(LEADS_DIR, 'lawyer-modern.json'),
    stateFile: path.join(STATE_DIR, 'send-state-lawyer.json'),
    progressFile: path.join(STATE_DIR, 'osm-region-progress-lawyer.json'),
    chatbotFilter: true,
    defaultName: 'Law Firm',
  },

  plumber: {
    id: 'plumber',
    label: 'Plumbing services',
    osmTags: [
      'craft=plumber',
      'shop=plumbing',
      'office=plumber',
    ],
    leadsFile: path.join(LEADS_DIR, 'plumber-modern.json'),
    stateFile: path.join(STATE_DIR, 'send-state-plumber.json'),
    progressFile: path.join(STATE_DIR, 'osm-region-progress-plumber.json'),
    chatbotFilter: true,
    defaultName: 'Plumbing Service',
  },

  hvac: {
    id: 'hvac',
    label: 'HVAC services',
    osmTags: [
      'craft=hvac',
      'shop=hvac',
      'office=hvac',
      'craft=heating_engineer',
    ],
    leadsFile: path.join(LEADS_DIR, 'hvac-modern.json'),
    stateFile: path.join(STATE_DIR, 'send-state-hvac.json'),
    progressFile: path.join(STATE_DIR, 'osm-region-progress-hvac.json'),
    chatbotFilter: true,
    defaultName: 'HVAC Service',
  },
};

export function getIndustry(id: string): IndustryConfig {
  const industry = INDUSTRIES[id];
  if (!industry) {
    const valid = Object.keys(INDUSTRIES).join(', ');
    throw new Error(`Unknown industry "${id}". Valid: ${valid}`);
  }
  return industry;
}

export function listIndustries(): string[] {
  return Object.keys(INDUSTRIES);
}
