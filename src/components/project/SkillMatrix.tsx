// ═══ SKILL MATRIX — Parent component with tab routing ═══
// Loads all data once via service, distributes to tab components.

import { useState, useEffect } from 'preact/hooks';
import type { AppUser, SkillProfile, Skill, ProfileSkill, MemberSkill, Member, GapInfo } from '@app-types/index';
import { loadSkillMatrixData, type SkillMatrixData } from '@services/skills';
import { Icon } from '@components/common/Icon';
import { Loading, ErrorCard } from '@components/common/Feedback';
import { TabPerfiles } from './TabPerfiles';
import { TabPersonas } from './TabPersonas';
import { TabMatriz } from './TabMatriz';
import { TabFormacion } from './TabFormacion';
import { TabFTEs } from './TabFTEs';
import { OrgChart } from './OrgChart';

// ── Tab definitions ──

interface TabDef {
  id: string;
  icon: string;
  label: string;
  smOnly: boolean;
}

const ALL_TABS: TabDef[] = [
  { id: 'perfiles',    icon: 'Target',        label: 'Perfiles',    smOnly: true },
  { id: 'personas',    icon: 'Users',         label: 'Personas',    smOnly: true },
  { id: 'matriz',      icon: 'BarChart3',     label: 'Matriz',      smOnly: true },
  { id: 'formacion',   icon: 'GraduationCap', label: 'Formación',   smOnly: true },
  { id: 'ftes',        icon: 'Calendar',      label: 'FTEs',        smOnly: false },
  { id: 'organigrama', icon: 'GitBranch',     label: 'Organigrama', smOnly: false },
];

// ── Props ──

interface SkillMatrixProps {
  user: AppUser;
  sala: string;
}

// ── Component ──

export function SkillMatrix({ user, sala }: SkillMatrixProps) {
  const isSM = user?._isAdmin || user?.isSuperuser;
  const tabs = isSM ? ALL_TABS : ALL_TABS.filter(t => !t.smOnly);
  const [activeTab, setActiveTab] = useState(isSM ? 'perfiles' : 'ftes');

  // Data
  const [data, setData] = useState<SkillMatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    loadSkillMatrixData(sala).then(result => {
      if (result.ok) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error.userMessage || 'Error cargando datos');
      }
      setLoading(false);
    });
  }, [sala]);

  // Refresh helper — tabs call this after CRUD ops
  const refresh = () => {
    loadSkillMatrixData(sala).then(result => {
      if (result.ok) setData(result.data);
    });
  };

  if (loading) return <Loading message="Cargando equipo..." />;
  if (error) return <ErrorCard message={error} onRetry={refresh} />;
  if (!data) return null;

  return (
    <div>
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 16, borderRadius: 12,
        overflow: 'hidden', border: '1.5px solid #E5E5EA', width: 'fit-content',
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '8px 16px', fontSize: 12,
              fontWeight: activeTab === t.id ? 700 : 500,
              background: activeTab === t.id ? '#1D1D1F' : '#FFF',
              color: activeTab === t.id ? '#FFF' : '#6E6E73',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <Icon name={t.icon} size={13} color={activeTab === t.id ? '#FFF' : '#86868B'} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'perfiles' && (
        <TabPerfiles
          profiles={data.profiles}
          skills={data.skills}
          profSkills={data.profSkills}
          categories={data.categories}
          sala={sala}
          onRefresh={refresh}
        />
      )}
      {activeTab === 'personas' && (
        <TabPersonas
          team={data.team}
          profiles={data.profiles}
          profSkills={data.profSkills}
          memSkills={data.memSkills}
          memProfiles={data.memProfiles}
          skills={data.skills}
          categories={data.categories}
          sala={sala}
          onRefresh={refresh}
        />
      )}
      {activeTab === 'matriz' && (
        <TabMatriz
          team={data.team}
          profiles={data.profiles}
          skills={data.skills}
          profSkills={data.profSkills}
          memSkills={data.memSkills}
          memProfiles={data.memProfiles}
          categories={data.categories}
        />
      )}
      {activeTab === 'formacion' && (
        <TabFormacion
          team={data.team}
          gaps={data.gaps}
          actions={data.actions}
          catalog={data.catalog}
          skills={data.skills}
          sala={sala}
          onRefresh={refresh}
        />
      )}
      {activeTab === 'ftes' && (
        <TabFTEs team={data.team} sala={sala} />
      )}
      {activeTab === 'organigrama' && (
        <OrgChart
          team={data.team}
          org={data.orgChart}
          onSetManager={async (memberId, managerId) => {
            const { saveOrgNode } = await import('@data/team');
            await saveOrgNode(sala, memberId, managerId);
            refresh();
          }}
          saving={false}
        />
      )}
    </div>
  );
}
