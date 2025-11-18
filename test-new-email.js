// Test script for new enhanced email templates
// Usage: node test-new-email.js <contact_id>

const VERCEL_URL = process.env.VERCEL_URL || 'https://fuel-sight-guardian-ce89d8de.vercel.app';

async function testEmail(contactId, frequency = 'daily', useEnhanced = true) {
  console.log(`\n🧪 Testing ${frequency} report (${useEnhanced ? 'enhanced' : 'legacy'})...`);

  try {
    const response = await fetch(`${VERCEL_URL}/api/test-send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contact_id: contactId,
        use_enhanced: useEnhanced,
        frequency: frequency
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log(`   📧 To: ${result.data.recipient}`);
      console.log(`   🏢 Customer: ${result.data.customer}`);
      console.log(`   🛢️  Tanks: ${result.data.tanks_included}`);
      console.log(`   📊 Template: ${result.data.template_type}`);
      console.log(`   📅 Frequency: ${result.data.frequency}`);
      console.log(`   ⏱️  Duration: ${result.data.duration}ms`);
      if (result.data.email_id) {
        console.log(`   🆔 Email ID: ${result.data.email_id}`);
      }
    } else {
      console.error('❌ Failed to send email');
      console.error('   Error:', result.error);
      console.error('   Message:', result.message);
    }

    return result;
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return null;
  }
}

async function runTests(contactId) {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('📧 ENHANCED EMAIL TEMPLATE TESTING');
  console.log('════════════════════════════════════════════════════════');
  console.log(`Contact ID: ${contactId}`);

  // Test 1: Daily Enhanced Report
  await testEmail(contactId, 'daily', true);
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Weekly Enhanced Report
  await testEmail(contactId, 'weekly', true);
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Monthly Enhanced Report
  await testEmail(contactId, 'monthly', true);

  console.log('\n════════════════════════════════════════════════════════');
  console.log('✅ Testing complete! Check your inbox.');
  console.log('════════════════════════════════════════════════════════\n');
}

// Run from command line
const contactId = process.argv[2];
if (!contactId) {
  console.error('❌ Error: Please provide a contact_id');
  console.error('Usage: node test-new-email.js <contact_id>');
  process.exit(1);
}

runTests(contactId);
