import { Button, Container } from '@mantine/core';
import { Outlet, Link } from 'react-router-dom';
import { Brand } from '../shared/ui/Brand';
import styles from './PublicLayout.module.css';

export default function PublicLayout() {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Container size={1120} className={styles.headerInner}>
          <Brand />
          <Button component={Link} to="/book" variant="light" size="sm">
            Забронировать звонок
          </Button>
        </Container>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
