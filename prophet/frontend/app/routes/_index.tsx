import { useEffect, useState } from "react";
import { Page, Layout, Card, BlockStack, Text, Button, Spinner, InlineGrid, Divider, Banner } from "@shopify/polaris";
import { TrendCard } from "../components/TrendCard";
import { AgentLog } from "../components/AgentLog";

export default function Index() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanMarket = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/api/scan");
      if (!res.ok) throw new Error("Backend connection failed");
      const data = await res.json();
      setOpportunities(data);
    } catch (error) {
      console.error("Failed to fetch opportunities", error);
      setError("Could not connect to the Prophet Brain. Ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    scanMarket();
  }, []);

  const handleReject = (index: number) => {
    const newOpps = [...opportunities];
    newOpps.splice(index, 1);
    setOpportunities(newOpps);
  };

  return (
    <Page 
        title="Marketing" 
        subtitle="Prophet Prediction Engine"
        primaryAction={<Button variant="primary" onClick={scanMarket}>Rescan Market</Button>}
        fullWidth
    >
      <Layout>
        <Layout.Section>
            {error && (
                <Banner tone="critical" title="Connection Error" onDismiss={() => setError(null)}>
                    <p>{error}</p>
                </Banner>
            )}
            
            <Card>
                <BlockStack gap="400">
                    <Text as="h3" variant="headingSm">Last 30 days</Text>
                    <Divider />
                    <InlineGrid columns={['oneThird', 'oneThird', 'oneThird']} gap="400">
                        <BlockStack gap="200">
                            <Text as="p" tone="subdued">Active Scans</Text>
                            <Text as="h4" variant="headingMd">{loading ? "-" : "1,240"}</Text>
                            <div style={{height: '4px', width: '100%', background: '#E4E5E7', borderRadius: '2px'}}>
                                <div style={{height: '100%', width: '70%', background: '#98c6cd', borderRadius: '2px'}}></div>
                            </div>
                        </BlockStack>
                        <BlockStack gap="200">
                            <Text as="p" tone="subdued">Potential Revenue</Text>
                            <Text as="h4" variant="headingMd">{loading ? "-" : "CA$12,400"}</Text>
                            <div style={{height: '4px', width: '100%', background: '#E4E5E7', borderRadius: '2px'}}>
                                <div style={{height: '100%', width: '45%', background: '#98c6cd', borderRadius: '2px'}}></div>
                            </div>
                        </BlockStack>
                        <BlockStack gap="200">
                            <Text as="p" tone="subdued">High Prob. Events</Text>
                            <Text as="h4" variant="headingMd">{loading ? "-" : "8"}</Text>
                             <div style={{height: '4px', width: '100%', background: '#E4E5E7', borderRadius: '2px'}}>
                                <div style={{height: '100%', width: '20%', background: '#98c6cd', borderRadius: '2px'}}></div>
                            </div>
                        </BlockStack>
                    </InlineGrid>
                </BlockStack>
            </Card>
        </Layout.Section>

        <Layout.Section>
            <BlockStack gap="500">
                <Text as="h2" variant="headingMd">Top Opportunities</Text>
                
                {loading && <div style={{textAlign: 'center', padding: '20px'}}><Spinner size="large" /></div>}

                {!loading && opportunities.length === 0 && !error && (
                     <Card>
                        <div style={{padding: '40px', textAlign: 'center'}}>
                            <BlockStack gap="200">
                                <Text as="p" variant="bodyLg" tone="subdued">No high-probability opportunities found right now.</Text>
                                <Text as="p">Please select a different period or rescan.</Text>
                            </BlockStack>
                        </div>
                    </Card>
                )}

                {!loading && opportunities.map((opp, i) => (
                    <BlockStack key={i} gap="400">
                         <TrendCard 
                            opportunity={opp} 
                            onReject={() => handleReject(i)} 
                        />
                         <AgentLog logs={opp.logs} />
                    </BlockStack>
                ))}
            </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
