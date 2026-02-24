import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import { supabase } from '../../../lib/supabaseClient';

export default function CloseOutPage() {
  const router = useRouter();
  const { id } = router.query;
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    time_arrived: '',
    time_complete: '',
    downtime_minutes: 0,
    delay_time_minutes: 0,
    remedy: '',
    spares_used: '',
    status: 'Closed',
  });

  useEffect(() => {
    if (!id) return;

    async function fetchBreakdown() {
      setLoading(true);
      const { data, error } = await supabase
        .from('breakdowns')
        .select(`
          *,
          operator:staff!operator_id(full_name),
          supervisor:staff!supervisor_id(full_name)
        `)
        .eq('id', id)
        .single();

      if (error) {
        setError(error.message);
      } else if (data) {
        setBreakdown(data);
        setFormData({
          time_arrived: data.time_arrived || '',
          time_complete: data.time_complete || '',
          downtime_minutes: data.downtime_minutes || 0,
          delay_time_minutes: data.delay_time_minutes || 0,
          remedy: data.remedy || '',
          spares_used: data.spares_used || '',
          status: 'Closed',
        });
      }
      setLoading(false);
    }

    fetchBreakdown();
  }, [id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase
      .from('breakdowns')
      .update(formData)
      .eq('id', id);

    if (error) {
      setError(error.message);
    } else {
      router.push('/admin');
    }

    setLoading(false);
  };

  if (loading) return <Layout>Loading...</Layout>;
  if (error) return <Layout>Error: {error}</Layout>;
  if (!breakdown) return <Layout>Breakdown not found.</Layout>;

  return (
    <Layout title={`Close Out #${breakdown.id}`}>
        <h1>Close Out Breakdown #{breakdown.id}</h1>
        <p><strong>Equipment:</strong> {breakdown.equipment_item}</p>
        <p><strong>Operator:</strong> {breakdown.operator.full_name}</p>
        <p><strong>Supervisor:</strong> {breakdown.supervisor.full_name}</p>
        <p><strong>Description:</strong> {breakdown.description}</p>

        <form onSubmit={handleSubmit}>
            <div className="admin-row">
              <div className="admin-field">
                <label htmlFor="time_arrived">Time Arrived</label>
                <input id="time_arrived" name="time_arrived" type="time" className="input" value={formData.time_arrived} onChange={handleInputChange} />
              </div>
              <div className="admin-field">
                <label htmlFor="time_complete">Time Complete</label>
                <input id="time_complete" name="time_complete" type="time" className="input" value={formData.time_complete} onChange={handleInputChange} />
              </div>
            </div>
            <div className="admin-row">
                <div className="admin-field">
                    <label htmlFor="downtime_minutes">Downtime (minutes)</label>
                    <input id="downtime_minutes" name="downtime_minutes" type="number" className="input" value={formData.downtime_minutes} onChange={handleInputChange} />
                </div>
                <div className="admin-field">
                    <label htmlFor="delay_time_minutes">Delay Time (minutes)</label>
                    <input id="delay_time_minutes" name="delay_time_minutes" type="number" className="input" value={formData.delay_time_minutes} onChange={handleInputChange} />
                </div>
            </div>
            <div className="admin-row">
              <div className="admin-field">
                <label htmlFor="remedy">Remedy</label>
                <textarea id="remedy" name="remedy" className="input" value={formData.remedy} onChange={handleInputChange} />
              </div>
            </div>
            <div className="admin-row">
              <div className="admin-field">
                <label htmlFor="spares_used">Spares Used</label>
                <textarea id="spares_used" name="spares_used" className="input" value={formData.spares_used} onChange={handleInputChange} />
              </div>
            </div>
            <button type="submit" className="btn primary" disabled={loading}>{loading ? 'Saving...' : 'Save and Close'}</button>
        </form>
    </Layout>
  );
}
