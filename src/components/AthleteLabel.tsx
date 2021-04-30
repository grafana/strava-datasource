import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { InlineFormLabel, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    athleteLabel: css`
      height: ${theme.spacing.formInputHeight}px;
      padding: 2px;
      margin-right: 0px;
      border-radius: ${theme.border.radius.md};
      background-color: ${theme.palette.dark4};
    `,
    athleteAvatar: css`
      height: 28px;
      border-radius: 50%;
    `,
  };
});

interface Props {
  athlete: any;
}

export const AthleteLabel: FC<Props> = ({ athlete }) => {
  const styles = getStyles(useTheme());
  const imgClass = cx('filter-table__avatar', styles.athleteAvatar);
  return (
    <div className="gf-form">
      <div className={styles.athleteLabel}>
        <img className={imgClass} src={athlete.profile_medium} />
      </div>
      <InlineFormLabel>
        {athlete.firstname} {athlete.lastname}
      </InlineFormLabel>
    </div>
  );
};
