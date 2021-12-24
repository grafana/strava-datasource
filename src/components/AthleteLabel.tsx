import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { InlineFormLabel, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { StravaAthlete } from '../types';

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
    athletePlaceholder: css`
      width: 28px;
    `,
  };
});

interface Props {
  athlete?: StravaAthlete;
}

export const AthleteLabel: FC<Props> = (props: Props) => {
  const { athlete } = props;
  const styles = getStyles(useTheme());
  const imgClass = cx('filter-table__avatar', styles.athleteAvatar);
  return (
    <div className="gf-form">
      {athlete?.profile_medium ? (
        <div className={styles.athleteLabel}>
          <img className={imgClass} src={athlete.profile_medium} />
        </div>
      ) : (
        <div className={styles.athletePlaceholder}></div>
      )}
      <InlineFormLabel>
        {athlete?.firstname} {athlete?.lastname}
      </InlineFormLabel>
    </div>
  );
};
