import React, { useState } from 'react';
import { Card, Text, Button, BlockStack, InlineStack, Badge } from '@shopify/polaris';

interface TrendOpportunity {
    event: string;
    probability: number;
    category: string;
    product_name: string;
    margin: string;
    design_prompt: string;
    seo_description: string;
    email_subject: string;
    logs: string[];
}

interface TrendCardProps {
    opportunity: TrendOpportunity;
    onReject: () => void;
}

export const TrendCard: React.FC<TrendCardProps> = ({ opportunity, onReject }) => {
    const [loading, setLoading] = useState(false);
    const [launched, setLaunched] = useState(false);

    const handleLaunch = async () => {
        setLoading(true);
        // Track acceptance
        await fetch('http://localhost:8000/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event_type: 'opportunity_accepted',
                properties: { category: opportunity.category, probability: opportunity.probability }
            })
        });

        // Launch product
        const response = await fetch('http://localhost:8000/api/launch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(opportunity)
        });

        if (response.ok) {
            setLaunched(true);
        }
        setLoading(false);
    };

    const handleIgnore = async () => {
        // Track rejection
        await fetch('http://localhost:8000/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event_type: 'opportunity_rejected',
                properties: { category: opportunity.category, probability: opportunity.probability }
            })
        });
        onReject();
    };

    if (launched) {
        return (
            <Card>
                <BlockStack gap="400" align="center">
                    <Text as="h2" variant="headingMd" tone="success">Drop Launched Successfully!</Text>
                    <Text as="p">The product is now active in your Shopify store.</Text>
                </BlockStack>
            </Card>
        );
    }

    return (
        <Card>
            <BlockStack gap="400">
                <InlineStack align="space-between">
                    <Badge tone={opportunity.probability > 0.8 ? 'success' : 'attention'}>
                        Probability: {(opportunity.probability * 100).toFixed(0)}%
                    </Badge>
                    <Text as="span" tone="subdued">{opportunity.category}</Text>
                </InlineStack>
                
                <Text as="h2" variant="headingLg">{opportunity.event}</Text>
                
                <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Proposed Product: {opportunity.product_name}</Text>
                    <Text as="p" tone="subdued">Design Concept: {opportunity.design_prompt}</Text>
                    <Text as="p" fontWeight="bold" tone="success">Est. Margin: {opportunity.margin}</Text>
                </BlockStack>

                <div style={{ background: '#f1f8f5', padding: '10px', borderRadius: '4px' }}>
                    <Text as="h4" variant="headingXs">Marketing Copy (AI Generated)</Text>
                    <Text as="p">Subject: {opportunity.email_subject}</Text>
                </div>

                <InlineStack gap="300">
                    <Button variant="primary" onClick={handleLaunch} loading={loading}>
                        Launch Drop
                    </Button>
                    <Button onClick={handleIgnore} disabled={loading}>
                        Ignore
                    </Button>
                </InlineStack>
            </BlockStack>
        </Card>
    );
};
