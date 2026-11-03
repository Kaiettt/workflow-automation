import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Footer } from './Footer';

describe('Footer', () => {
  afterEach(cleanup);

  it('renders branding and description', () => {
    render(<Footer />);

    expect(screen.getByText('FlowPilot')).toBeTruthy();
    expect(screen.getByText('• Visual Workflow Automation')).toBeTruthy();
    expect(screen.getByText('Open Source Developer Edition')).toBeTruthy();
  });

  it('renders links to external repository and sections', () => {
    render(<Footer />);

    const githubLink = screen.getByRole('link', { name: /GitHub/i });
    expect(githubLink.getAttribute('href')).toBe('https://github.com/Kaiettt/workflow-automation');
    expect(screen.getByRole('link', { name: 'Templates' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Canvas' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Architecture' })).toBeTruthy();
  });
});

