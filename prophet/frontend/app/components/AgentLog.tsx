import React from 'react';
import { Card, Text, BlockStack, List, Badge } from '@shopify/polaris';

interface AgentLogProps {
  logs: string[];
}

export const AgentLog: React.FC<AgentLogProps> = ({ logs }) => {
  return (
    <Card>
        <BlockStack gap="200">
            <Text as="h3" variant="headingSm">Agent Decision Log</Text>
            <div style={{ background: '#f4f6f8', padding: '10px', borderRadius: '4px' }}>
                <List type="number">
                    {logs.map((log, index) => (
                        <List.Item key={index}>
                            <Text as="span" variant="bodyMd">{log}</Text>
                        </List.Item>
                    ))}
                </List>
            </div>
        </BlockStack>
    </Card>
  );
};
