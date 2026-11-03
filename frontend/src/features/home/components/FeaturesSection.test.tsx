import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FeaturesSection } from './FeaturesSection';

describe('FeaturesSection', () => {
  afterEach(cleanup);

  it('renders section title and architecture capabilities', () => {
    render(<FeaturesSection />);

    expect(screen.getByText('Architecture & Core Engine')).toBeTruthy();
    expect(screen.getByText('Visual Graph Canvas')).toBeTruthy();
    expect(screen.getByText('Built-in Connectors')).toBeTruthy();
    expect(screen.getByText('CQRS Execution Engine')).toBeTruthy();
    expect(screen.getByText('Drafts & Immutable Versions')).toBeTruthy();
  });

  it('renders technology tags for capabilities', () => {
    render(<FeaturesSection />);

    expect(screen.getByText('React Flow 12')).toBeTruthy();
    expect(screen.getByText('Plugin Framework')).toBeTruthy();
    expect(screen.getByText('NestJS CQRS')).toBeTruthy();
    expect(screen.getByText('Concurrency Safe')).toBeTruthy();
  });
});

