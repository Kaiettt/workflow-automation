import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TemplateGrid } from './TemplateGrid';

describe('TemplateGrid', () => {
  afterEach(cleanup);

  it('renders starter templates including blank workflow', () => {
    render(<TemplateGrid onSelectTemplate={vi.fn()} />);

    expect(screen.getByText('Starter Templates')).toBeTruthy();
    expect(screen.getByText('Blank Workflow')).toBeTruthy();
    expect(screen.getByText('Stripe Webhook to PostgreSQL')).toBeTruthy();
    expect(screen.getByText('Scheduled Database Cleanup')).toBeTruthy();
    expect(screen.getByText('HTTP 5xx Alert to Ops')).toBeTruthy();
    expect(screen.getByText('Postgres to Redis Cache Sync')).toBeTruthy();
  });

  it('calls onSelectTemplate when Blank Workflow is clicked', () => {
    const onSelectTemplate = vi.fn();
    render(<TemplateGrid onSelectTemplate={onSelectTemplate} />);

    fireEvent.click(screen.getByRole('button', { name: /Blank Workflow/i }));
    expect(onSelectTemplate).toHaveBeenCalledWith('Blank Workflow');
  });

  it('calls onSelectTemplate with template name when a template card is clicked', () => {
    const onSelectTemplate = vi.fn();
    render(<TemplateGrid onSelectTemplate={onSelectTemplate} />);

    fireEvent.click(screen.getByRole('button', { name: /Stripe Webhook to PostgreSQL/i }));
    expect(onSelectTemplate).toHaveBeenCalledWith('Stripe Webhook to PostgreSQL');
  });

  it('disables template cards when loading is true', () => {
    render(<TemplateGrid onSelectTemplate={vi.fn()} loading={true} />);

    expect(screen.getByRole('button', { name: /Blank Workflow/i }).hasAttribute('disabled')).toBe(true);
  });
});

